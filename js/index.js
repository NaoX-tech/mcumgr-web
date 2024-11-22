
const screens = {
    initial: document.getElementById('initial-screen'),
    connecting: document.getElementById('connecting-screen'),
    connected: document.getElementById('connected-screen'),
    fetching: document.getElementById('fetching-screen'),
};

const deviceName = document.getElementById('device-name');
const connectButton = document.getElementById('button-connect');
const disconnectButton = document.getElementById('button-disconnect');
const bluetoothIsAvailable = document.getElementById('bluetooth-is-available');
const bluetoothIsAvailableMessage = document.getElementById('bluetooth-is-available-message');
const connectBlock = document.getElementById('connect-block');
const downloadButton = document.getElementById('button-download');
const downloadFiles = document.getElementById('file-list');

const getsizeButton = document.getElementById('button-getsize');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');

const tmpdevicename = document.getElementById('device-name-tmp');
const preFetchingCD = document.getElementById('pre-fetching-cd');

let file = new Uint8Array();

navigator.bluetooth.getAvailability().then((e) => {
    if(e) {
        connectBlock.style.display = 'block';
    }
});
let fileData = null;
let images = [];
/*
const reg = /NaoX\s.
deviceNameInput.addEventListener('input', (e) => {
    if(!reg.test(e.target.value)) {
        e.target.value = 'NaoX';
    } else {
        e.target.value = e.target.value;
    }
}); */

const mcumgr = new MCUManager();
mcumgr.onConnecting(() => {
    console.log('Connecting...');
    screens.initial.style.display = 'none';

    screens.fetching.style.display = 'none';
    screens.connecting.style.display = 'block';
    screens.connected.style.display = 'none';
});
mcumgr.onConnect(() => {
    let cd = 10;
    screens.initial.style.display = 'none';
    screens.connecting.style.display = 'none';
    screens.fetching.style.display = 'none';
    screens.connected.style.display = 'block';
    screens
    mcumgr.cmdImageState();
    tmpdevicename.innerText = mcumgr._device.name;
    preFetchingCD.innerText = cd;
    disconnectButton.style.display = 'block';
    let interval = setInterval(() => {
        if(cd > 0) {
            cd--;
            preFetchingCD.innerText = cd;
        } else {
            clearInterval(interval);
            screens.initial.style.display = 'none';
            screens.connecting.style.display = 'none';
            screens.fetching.style.display = 'block';
            screens.connected.style.display = 'none';
            mcumgr._getFilesSizes();
        }
    }, 1000);
});
mcumgr.onGotMaxSize((e) => {

    console.log('Max ...');
    console.log(e);
    mcumgr._download();
});
mcumgr.onFetching(async (e) => {
    console.log('Fetching ...');
    console.log(mcumgr.getdownloadedFiles());
    console.log(mcumgr.getdownloadSpeed());
    console.log(e);
});
mcumgr.onDisconnect(() => {
    deviceName.innerText = 'Connect your device';
    screens.connecting.style.display = 'none';
    screens.connected.style.display = 'none';
    screens.fetching.style.display = 'none';
    screens.initial.style.display = 'block';
});

connectButton.addEventListener('click', async () => {
    let filters = [{ namePrefix: 'NaoX' }];
    await mcumgr.connect(filters,file);
});

disconnectButton.addEventListener('click', async () => {
    mcumgr.disconnect();
});


downloadButton.addEventListener('click', async () => {
    mcumgr._download();
});


getsizeButton.addEventListener('click', async () => {
    mcumgr._getFilesSizes();
});
mcumgr.onDoneDownload((e) => {
    downloadFiles.innerHTML = '';
    let testZip = new JSZip();
    for(let x = 0 ; x < Object.keys(e).length; x++){
        if(e[x].length > 0){
            let tmpFile = new Uint8Array(e[x]);
            let blob = new Blob([tmpFile],{type: 'application/octet-stream'});
            testZip.file(`EDF ${x}.edf`,blob);
            let url = URL.createObjectURL(blob);
            const div = document.createElement('div');
            div.innerHTML = `<div>EDF ${x} </div>`;
            downloadFiles.appendChild(div);
        } else {
            
        }
    };
    testZip.generateAsync({type:"blob"}).then(function(content) {
        let url = URL.createObjectURL(content);
        const div = document.createElement('div');
        div.innerHTML = `<a id="downloadzip" href="${url}" download="EDF.zip" target="_blank">Download all</a>`;
        downloadFiles.appendChild(div);
        return content;
    }).then(async (content) => {
        document.getElementById('downloadzip').click();
         /* if (window.showSaveFilePicker) {
            const options = {
                suggestedName: 'EDF.zip',
                types: [{
                    description: 'Zip of EDF files',
                }],
            };

            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            // Open the folder containing the saved file
            const directoryHandle = await handle.getParent();
            const fileHandle = await directoryHandle.getFileHandle(handle.name);
            const file = await fileHandle.getFile();
            const fileURL = URL.createObjectURL(file);
            window.open(fileURL, '_blank');
        } else {
            alert('Your browser does not support the File System Access API.');
        } */
    });
});
