
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

class MCUManager {
    constructor(di = {}) {
        this.SERVICE_UUID = '8d53dc1d-1db7-4cd3-868b-8a527460aa84';
        this.CHARACTERISTIC_UUID = 'da2e7828-fbce-4e01-ae9e-261174997c48';
        this._mtu = 140;
        this._device = null;
        this._service = null;
        this._characteristic = null;
        this._connectCallback = null;
        this._connectingCallback = null;
        this._fetchingCallback = null;
        this._gotMaxSize = null;
        this._disconnectCallback = null;
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
                console.log('disconnect event :',event);
                this._logger.info(event);
                if (!this._userRequestedDisconnect) {
                    this._logger.info('Trying to reconnect');
                    this._connect(1000);
                } else {
                    this._disconnected();
                }
            });
            this._connect(files);
        } catch (error) {
            console.log('error :',error);
            this._logger.error(error);
            await this._disconnected();
            return;
        }
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
                    if(call) {
                        let packet = new Uint8Array(event.target.value.buffer);
                        this.downloadSpeed = packet.length * (1000 / (new Date().getTime() - startTimer));
                        startTimer = new Date().getTime();
                        speedPackets += packet.length;
                        tmpfile = [...tmpfile,...packet];
                        console.log('cancel download :', this.cancelDownload);
                        console.log('remaingin packets :', maxSize - downloadedTotal);
                        console.log('remaining time :',  (maxSize - downloadedTotal)/ this.downloadSpeed + 's');
                        let fetchingStatus = {
                            "speed" : this.downloadSpeed,
                            "maxSize" : maxSize,
                            "downloaded" : downloadedTotal
                        }
                        this._fetchingCallback(fetchingStatus);

                        try {
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            console.log('cbor :',cbor);
                            if(cbor.data !== undefined){
                                //console.log('download time :', maxSize/this.downloadSpeed + 'ms');
                                filestotal[filenum] = [...filestotal[filenum], ...cbor.data];
                                //console.log(cbor);
                                //console.log(filestotal);
                                downloadedTotal += cbor.data.length;
                                //this.downloadSpeed = speedPackets * (1000 / (new Date().getTime() - startTimer));
                                //speedPackets = 0;

                            }
                            offset = cbor.off + tmpfile.length;
                            tmpfile = [];
                            if(cbor.rc !== undefined){
                                if(filestotal[filenum].length === 0) delete filestotal[filenum];
                                filenum = 0;
                                call = false;
                                downloading = false;
                                this._doneDownload(filestotal);
                            }
                            if(cbor.data.length !== 0 && cbor.data !== undefined && !this.cancelDownload){
                                this._downloadBis();
                            } else {
                                offset = 0;
                                filenum++;  
                                filestotal[filenum]= [];
                                if(cbor.rc === undefined && !this.cancelDownload)this._downloadBis();
                            }
                        } catch (err) {
                        }
                    } else if(getSize) {
                        let packet = new Uint8Array(event.target.value.buffer);
                        speedPackets += packet.length;
                        tmpfile = [...tmpfile,...packet];
                        try{
                            let cbor = await CBOR.decode(new Uint8Array(tmpfile).buffer.slice(8));
                            if(cbor.rc === undefined){
                                maxSize += cbor.len;
                                filenum++;
                                tmpfile = [];
                                this.downloadSpeed = speedPackets * (1000 / (new Date().getTime() - startTimer));
                                console.log("speed download bytes/S : ",this.downloadSpeed);
                                speedPackets = 0;
                                this._getFilesSizes();
                                console.log('download time :', maxSize/this.downloadSpeed + 'ms');
                                console.log(maxSize);
                            } else {
                                filenum = 0;
                                tmpfile = [];
                                this._gotMaxSize(maxSize);
                            }
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
                await this._disconnected();
            }
        }, 1000);
    }
    disconnect() {
        console.log('call disconnect');
        this._userRequestedDisconnect = true;
        filestotal = {};
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
    onFetching(callback) {
        this._fetchingCallback = callback;
        return this;
    }
    onGotMaxSize(callback) {
        this._gotMaxSize = callback;
        return this;
    }
    onDisconnect(callback) {
        console.log('disconnecting');
        this._disconnectCallback = callback;
        return this;
    }
    onDoneDownload(callback) {
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

    async _connected() {
        if (this._connectCallback) this._connectCallback();
    }
    async _disconnected() {
        this._logger.info('Disconnected.');
        if (this._disconnectCallback) this._disconnectCallback();
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
            downloading = true;
        }
    }
    async _downloadBis() {
        //startTimer = new Date().getTime();
        if(call === false){
            call = true;
            offset = 0;
            filestotal[filenum] = [];
        }
        let req = {"off":offset,"name":`/lfs1/EEG${filenum}.edf`};
        this._sendMessage(0, MGMT_GROUP_ID_FS, 0, req);
    }
    async _getFilesSizes() {
        startTimer = new Date().getTime();
        getSize = true;
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
    smpEcho(message) {
        return this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_OS, OS_MGMT_ID_ECHO, { d: message });
    }
    cmdImageState() {
        return this._sendMessage(MGMT_OP_READ, MGMT_GROUP_ID_IMAGE, IMG_MGMT_ID_STATE);
    }
    cmdImageErase() {
        return this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_IMAGE, IMG_MGMT_ID_ERASE, {});
    }
    cmdImageTest(hash) {
        return this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_IMAGE, IMG_MGMT_ID_STATE, { hash, confirm: false });
    }
    cmdImageConfirm(hash) {
        return this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_IMAGE, IMG_MGMT_ID_STATE, { hash, confirm: true });
    }
    _hash(image) {
        return crypto.subtle.digest('SHA-256', image);
    }
    async _uploadNext() {
        if (this._uploadOffset >= this._uploadImage.byteLength) {
            this._uploadIsInProgress = false;
            this._imageUploadFinishedCallback();
            return;
        }

        const nmpOverhead = 8;
        const message = { data: new Uint8Array(), off: this._uploadOffset };
        if (this._uploadOffset === 0) {
            message.len = this._uploadImage.byteLength;
            message.sha = new Uint8Array(await this._hash(this._uploadImage));
        }
        this._imageUploadProgressCallback({ percentage: Math.floor(this._uploadOffset / this._uploadImage.byteLength * 100) });

        const length = this._mtu - CBOR.encode(message).byteLength - nmpOverhead;

        message.data = new Uint8Array(this._uploadImage.slice(this._uploadOffset, this._uploadOffset + length));

        this._uploadOffset += length;

        this._sendMessage(MGMT_OP_WRITE, MGMT_GROUP_ID_IMAGE, IMG_MGMT_ID_UPLOAD, message);
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

