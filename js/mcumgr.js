// Opcodes
const MGMT_OP_READ = 0;
const MGMT_OP_READ_RSP = 1;
const MGMT_OP_WRITE = 2;
const MGMT_OP_WRITE_RSP = 3;

// Groups
const MGMT_GROUP_ID_OS = 0;
const MGMT_GROUP_ID_IMAGE = 1;
const MGMT_GROUP_ID_STAT = 2;
const MGMT_GROUP_ID_CONFIG = 3;
const MGMT_GROUP_ID_LOG = 4;
const MGMT_GROUP_ID_CRASH = 5;
const MGMT_GROUP_ID_SPLIT = 6;
const MGMT_GROUP_ID_RUN = 7;
const MGMT_GROUP_ID_FS = 8;
const MGMT_GROUP_ID_SHELL = 9;

// OS group
const OS_MGMT_ID_ECHO = 0;
const OS_MGMT_ID_CONS_ECHO_CTRL = 1;
const OS_MGMT_ID_TASKSTAT = 2;
const OS_MGMT_ID_MPSTAT = 3;
const OS_MGMT_ID_DATETIME_STR = 4;
const OS_MGMT_ID_RESET = 5;

// Image group
const IMG_MGMT_ID_STATE = 0;
const IMG_MGMT_ID_UPLOAD = 1;
const IMG_MGMT_ID_FILE = 2;
const IMG_MGMT_ID_CORELIST = 3;
const IMG_MGMT_ID_CORELOAD = 4;
const IMG_MGMT_ID_ERASE = 5;

let tmpfile = [];
let call = false;
let erase = false;
let getSize = false;
let packetSize = 0;
let nbPackets = 0;
let filedone = false;
let offset = 0;
let filenum = 0;
let filelen = 0;
let filestotal = {};
let maxSize = 0;
let downloading = false;
let startTimer;
let speedPackets = 0;
let downloadedTotal = 0;
let doneCheck = false;
let checkHash = false;
let echo = false;

let tmpCheckSum = 0;

class MCUManager {
    constructor(di = {}) {
        this.SERVICE_UUID = '8d53dc1d-1db7-4cd3-868b-8a527460aa84';
        this.CHARACTERISTIC_UUID = 'da2e7828-fbce-4e01-ae9e-261174997c48';
        this._mtu = 140;
        this._device = null;
        this._service = null;
        this._characteristic = null;
        this._connectCallback = null;
        this._connectFailedCallback = null;
        this._connectingCallback = null;
        this._eraseCallback = null;
        this._errorDisconnectedCallback = null;
        this._fetchingCallback = null;
        this.fetchingStatus = null;
        this._fetchErrorCallback = null;
        this._gotMaxSize = null;
        this._disconnectCallback = null;
        this._echoCallback = null;
        this._messageCallback = null;
        this._imageUploadProgressCallback = null;
        this._uploadIsInProgress = false;
        this.downloadSpeed = 0;
        this.cancelDownload = false;
        this._doneDownloadCallback = null;
        this._buffer = new Uint8Array();
        this._logger = di.logger || { info: console.log, error: console.error };
        this._seq = 0;
        this._userRequestedDisconnect = false;
    }
    async _requestDevice(filters) {
        const params = {
            acceptAllDevices: true,
            optionalServices: [this.SERVICE_UUID]
        };
        if (filters) {
            params.filters = filters;
            params.acceptAllDevices = false;
        }
        return navigator.bluetooth.requestDevice(params);
    }
    async connect(filters, files) {
        try {
            this._device = await this._requestDevice(filters);
            this._logger.info(`Connecting to device ${this.name}...`);
            this._device.addEventListener('gattserverdisconnected', async event => {
                console.log(this._userRequestedDisconnect);
                if(!this._userRequestedDisconnect) {
                    this._errorDisconnected();
                } else {
                    this._disconnected();
                }
            });
            filenum = 0;
            this._connect(files);
        } catch (error) {
            console.log('error :',error);
            this._logger.error(error);
            await this._connectFailedCallback();
            return;
        }
    }
    async clearDevice() {
        try {
            erase = true;
            call = false;
            getSize = false;
            this._sendMessage(MGMT_OP_WRITE, 63, 0,{});
        } catch (error) {
            console.log('error :',error);
            this._logger.error(error);
        }
    }

    async getSHA256(path) {
        try {
            checkHash = true;
            let req = {"name":path,"type":"sha256"};
            this._sendMessage(0, MGMT_GROUP_ID_FS, 2, req);
        } catch (error) {
            console.log('error :',error);
            this._logger.error(error);
        }
    }

    async convertToHex(buffer) {
        return Array.prototype.map.call(buffer, x => x.toString(16).padStart(2, '0')).join('');
    }
          
          

    _connect(files) {
        setTimeout(async () => {
            try {
                if (this._connectingCallback) this._connectingCallback();
                const server = await this._device.gatt.connect();
                this._logger.info(`Server connected.`);
                this._service = await server.getPrimaryService(this.SERVICE_UUID);
                this._logger.info(`Service connected.`);
                this._characteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_UUID);
                this._characteristic.addEventListener('characteristicvaluechanged', async (event) => {
                    let packet = new Uint8Array(event.target.value.buffer);
                    speedPackets += packet.length;
                    tmpfile = [...tmpfile,...packet];
                    console.log("echo :",echo);
                    console.log('tmpfile :',tmpfile);
                    console.log('checkHash :',checkHash);
                    console.log('call :',call);
                    console.log('getSize :',getSize);
                    if (echo) {
                        try {
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            console.log('cbor :',cbor);
                            this._onEcho(cbor);
                            tmpfile = [];
                            echo = false;
                        } catch (err) {
                        }
                    } else if(checkHash) {
                        try {
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            console.log('cbor :',cbor);
                            tmpfile = [];
                            speedPackets = 0;
                            let tmpsha = sha256.create();
                            let currentfile = new Uint8Array(filestotal[filenum-1]);
                            tmpsha.update(currentfile);
                            let filesha = tmpsha.array();
                            let checkSha = true;
                            for (let x = 0; x < filesha.length; x++) {
                                if (filesha[x] !== cbor.output[x]) {
                                    filenum--;
                                    downloadedTotal -= filestotal[filenum].length;
                                    filestotal[filenum] = [];

                                    checkSha = false;
                                    checkHash = false;
                                    call = false;
                                    downloading = false;
                                    this.fetchingStatus = false;
                                    this._fetchErrorCallback();
                                    break;
                                }
                            }

                        if(checkSha){
                            checkHash = false;
                            if (downloadedTotal === maxSize){
                                this.fetchingStatus = false;
                                filenum = 0;
                                call = false;
                                downloading = false;
                                let downloadStatus = {
                                    files : filestotal,
                                    status : 5,
                                }
                                this._doneDownload(downloadStatus);
                            } else {
                                if(cbor.rc === undefined) {
                                    if(downloadedTotal < maxSize){
                                        filestotal[filenum]= [];
                                        this._downloadBis();
                                    } 
                                }
                            }
                        }
                        } catch (err) {
                        }
                    } else if (call) {
                        try {
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            if(cbor.data !== undefined){
                                this.downloadSpeed = speedPackets * (1000 / (new Date().getTime() - startTimer));
                                speedPackets = 0;
                                filestotal[filenum] = [...filestotal[filenum], ...cbor.data];
                                downloadedTotal += cbor.data.length;
                                let fetchingStatus = {
                                    "speed" : this.downloadSpeed,
                                    "maxSize" : maxSize,
                                    "downloaded" : downloadedTotal
                                }
                                this._fetchingCallback(fetchingStatus);
                            }
                            if(tmpfile.length !== undefined) {
                                offset = cbor.off + cbor.data.length;
                                tmpfile = [];
                                if(cbor.rc !== undefined){
                                    if(filestotal[filenum].length === 0) delete filestotal[filenum];
                                    this.fetchingStatus = false;
                                    filenum = 0;
                                    call = false;
                                    downloading = false;
                                    let downloadStatus = {
                                        files : filestotal,
                                        status : cbor.rc
                                    }
                                    this._doneDownload(downloadStatus);
                                }
                                if(cbor.data.length !== 0 && cbor.data !== undefined && !this.cancelDownload){
                                    this._downloadBis();
                                } else {
                                    if(!this.cancelDownload){
                                        offset = 0;
                                        this.getSHA256(`/lfs1/EEG${filenum}.edf`);
                                        filenum++;
                                        checkHash = true;
                                    }
                                }
                            }
                        } catch (err) {
                            console.log('error :',err);
                        }
                    } else if(getSize) {

                        try{
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            console.log('cbor :',cbor);
                            if(cbor.rc === undefined){
                                maxSize += cbor.len;
                                filenum++;
                                tmpfile = [];
                                this.downloadSpeed = speedPackets * (1000 / (new Date().getTime() - startTimer));
                                speedPackets = 0;
                                this._getFilesSizes();
                            } else {
                                filenum = 0;
                                tmpfile = [];
                                this._gotMaxSize(maxSize);
                            }
                        } catch (err) {
                        }
                    } else if(erase) {
                        try{
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            if(cbor.rc !== undefined){
                                erase = false;
                                tmpfile = [];
                                this._eraseCallback(false);
                            }
                            this._eraseCallback(true);
                        } catch (err) {
                        }
                    }
                });
                await this._characteristic.startNotifications();
                await this._connected();
                if (this._uploadIsInProgress) {
                    this._uploadNext();
                }
            } catch (error) {
                this._logger.error(error);
                await this._connectFailedCallback();
            }
        }, 1000);
    }
    disconnect() {
        console.log('call disconnect');
        this._userRequestedDisconnect = true;
        this.fetchingStatus = false;
        checkHash = false;
        call = false;
        getSize = false;
        downloading = false;
        echo = false;
        tmpfile = [];
        downloadedTotal = 0;
        offset = 0;
        filenum = 0;
        filelen = 0;
        filestotal = {};
        maxSize = 0;
        this._doneDownload({});
        return this._device.gatt.disconnect();
    }
    onConnecting(callback) {
        this._connectingCallback = callback;
        return this;
    }
    onConnect(callback) {
        this._connectCallback = callback;
        return this;
    }
    onConnectFailed(callback) {
        this._connectFailedCallback = callback;
        return this;
    }
    onFetching(callback) {
        this._fetchingCallback = callback;
        return this;
    }

    onFetchError(callback) {
        this._fetchErrorCallback = callback;
        return this;
    }

    onErase(callback) {
        this._eraseCallback = callback;
        return this;
    }
    onGotMaxSize(callback) {
        this._gotMaxSize = callback;
        return this;
    }
    onErrorDisconnected(callback) {
        this._errorDisconnected = callback;
        return this;
    }
    onDisconnect(callback) {
        console.log('disconnecting');
        this._disconnectCallback = callback;
        return this;
    }
    onEcho(callback) {
        this._echoCallback = callback;
        return this;
    }
    onDoneDownload(callback) {
        this.fetchingStatus = false;
        tmpfile = [];
        downloadedTotal = 0;
        offset = 0;
        filenum = 0;
        filelen = 0;
        filestotal = {};
        maxSize = 0;
        this._downloadCallback = callback;
        return this;
    }

    async _fetchingCallback(data) {
        if (this._fetchingCallback) this._fetchingCallback(data);
    }

    async _gotMaxSizeCallback(data) {
        if (this._gotMaxSize) this._gotMaxSize(data);
    }
    async _doneDownload(data) {
        if (this._downloadCallback) this._downloadCallback(data);
    }

    async _onEcho(data) {
        if (this._echoCallback) this._echoCallback(data);
    }

    async _connected() {
        if (this._connectCallback) this._connectCallback();
    }
    async _errorDisconnected() {
        if (this._errorDisconnected) this._errorDisconnectedCallback();
    }
    async _fetchErrorCallback() {
        if (this._fetchErrorCallback) this._fetchErrorCallback();
    }
    async _connectFailedCallback() {
        if (this._connectFailedCallback) this._connectFailedCallback();
    }

    async _disconnected() {
        this._logger.info('Disconnected.');
        if (this._disconnectCallback) this._disconnectCallback(this._userRequestedDisconnect);
        this._device = null;
        this._service = null;
        this._characteristic = null;
        this._uploadIsInProgress = false;
        this._userRequestedDisconnect = false;
    }

    get name() {
        return this._device && this._device.name;
    }

    getdownloadSpeed() {
        return this.downloadSpeed;
    }
    getmaxSize() {
        return maxSize;
    }

    cancel() {
        if(this.cancelDownload === false){
            this.cancelDownload = true;

            this.fetchingStatus = false;
        }
    }

    getdownloadedFiles() {
        let downloadedFiles = 0;
        for (let i = 0; i < filestotal.length; i++) {
            downloadedFiles += filestotal[i].length;
        }
        return downloadedFiles;
    }

    async _sendMessage(op, group, id, data) {
        console.log('op :',op);
        console.log('group :',group);
        console.log('id :',id);
        console.log('data :',data);
        const _flags = 0;
        let encodedData = [];
        if (typeof data !== 'undefined') {
            encodedData = [...new Uint8Array(CBOR.encode(data))];
        }
        const length_lo = encodedData.length & 255;
        const length_hi = encodedData.length >> 8;
        const group_lo = group & 255;
        const group_hi = group >> 8;
        const message = [op, _flags, length_hi, length_lo, group_hi, group_lo, this._seq, id, ...encodedData];
        await this._characteristic.writeValueWithoutResponse(Uint8Array.from(message));
        this._seq = (this._seq + 1) % 256;
    }
    async _download() {
        if(downloading === false){
            this._downloadBis();
            this.cancelDownload = false;
            this.fetchingStatus = true;
            downloading = true;
        }
    }
    async _retryDownload() {
        tmpfile = [];
        this._downloadBis();
    }
    async _downloadBis() {
        startTimer = new Date().getTime();
        let downloadLength = filestotal[filenum] === undefined ? 0 : filestotal[filenum].length;
        let checkStuck;
        if(checkStuck !== undefined) {
            clearTimeout(checkStuck);
        }
        checkStuck = setTimeout(async () => {
            console.log(this.fetchingStatus);
            if(filestotal[filenum] !== undefined &&  filestotal[filenum].length === downloadLength && this.fetchingStatus) {
                if (this.cancelDownload === false) {
                    this.cancelDownload = true;
                    this.fetchingStatus = false;
                    this._fetchErrorCallback();
                }
            } else {
                clearTimeout(checkStuck);
            }
        }, 30000);
        if(call === false){
            call = true;
            offset = 0;
            filestotal[filenum] = [];
        }
        let req = {"off":offset,"name":`/lfs1/EEG${filenum}.edf`};
        console.log('req :',req);
        this._sendMessage(0, MGMT_GROUP_ID_FS, 0, req);
    }
    async _getFilesSizes() {
        startTimer = new Date().getTime();
        getSize = true;
        this.cancelDownload = false;
        let req = {"off":offset,"name":`/lfs1/EEG${filenum}.edf`};
        this._sendMessage(0, MGMT_GROUP_ID_FS, 0, req);
    }
    _notification(event) {
        const message = new Uint8Array(event.target.value.buffer);
        this._buffer = new Uint8Array([...this._buffer, ...message]);
        const messageLength = this._buffer[2] * 256 + this._buffer[3];
        if (this._buffer.length < messageLength + 8) return;
        this._processMessage(this._buffer.slice(0, messageLength + 8));
        this._buffer = this._buffer.slice(messageLength + 8);
    }
    _processMessage(message) {
        const [op, _flags, length_hi, length_lo, group_hi, group_lo, _seq, id] = message;
        const data = CBOR.decode(message.slice(8).buffer);
        const length = length_hi * 256 + length_lo;
        const group = group_hi * 256 + group_lo;
        if (group === MGMT_GROUP_ID_IMAGE && id === IMG_MGMT_ID_UPLOAD && (data.rc === 0 || data.rc === undefined) && data.off){
            this._uploadOffset = data.off;            
            this._uploadNext();
            return;
        }
        if (this._messageCallback) this._messageCallback({ op, group, id, data, length });
    }

    cmdReset() {
        return this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_OS, OS_MGMT_ID_RESET);
    }
    smpEcho() {
        echo = true;
        tmpfile = [];
        let req = {"off":0,"name":`/lfs1/VOID.VOID`};
        this._sendMessage(0, MGMT_GROUP_ID_FS, 0, req);
    }

    _hash(image) {
        return crypto.subtle.digest('SHA-256', image);
    }
    async cmdUpload(image, slot = 0) {
        if (this._uploadIsInProgress) {
            this._logger.error('Upload is already in progress.');
            return;
        }
        this._uploadIsInProgress = true;

        this._uploadOffset = 0;
        this._uploadImage = image;
        this._uploadSlot = slot;

        this._uploadNext();
    }
    async imageInfo(image) {
        // https://interrupt.memfault.com/blog/mcuboot-overview#mcuboot-image-binaries

        const info = {};
        const view = new Uint8Array(image);

        // check header length
        if (view.length < 32) {
            throw new Error('Invalid image (too short file)');
        }

        // check MAGIC bytes 0x96f3b83d
        if (view[0] !== 0x3d || view[1] !== 0xb8 || view[2] !== 0xf3 || view[3] !== 0x96) {
            throw new Error('Invalid image (wrong magic bytes)');
        }

        // check load address is 0x00000000
        if (view[4] !== 0x00 || view[5] !== 0x00 || view[6] !== 0x00 || view[7] !== 0x00) {
            throw new Error('Invalid image (wrong load address)');
        }

        const headerSize = view[8] + view[9] * 2**8;

        // check protected TLV area size is 0
        if (view[10] !== 0x00 || view[11] !== 0x00) {
            throw new Error('Invalid image (wrong protected TLV area size)');
        }

        const imageSize = view[12] + view[13] * 2**8 + view[14] * 2**16 + view[15] * 2**24;
        info.imageSize = imageSize;

        // check image size is correct
        if (view.length < imageSize + headerSize) {
            throw new Error('Invalid image (wrong image size)');
        }

        // check flags is 0x00000000
        if (view[16] !== 0x00 || view[17] !== 0x00 || view[18] !== 0x00 || view[19] !== 0x00) {
            throw new Error('Invalid image (wrong flags)');
        }

        const version = `${view[20]}.${view[21]}.${view[22] + view[23] * 2**8}`;
        info.version = version;

        info.hash = [...new Uint8Array(await this._hash(image.slice(0, imageSize + 32)))].map(b => b.toString(16).padStart(2, '0')).join('');

        return info;
    }
}

