
const screens = {
    initial: document.getElementById('initial-screen'),
    connecting: document.getElementById('connecting-screen'),
    connected: document.getElementById('connected-screen'),
    connectionlost: document.getElementById('connection-lost-screen'),
    fetching: document.getElementById('fetching-screen'),
    cancelfetching: document.getElementById('fetching-cancel-screen'),
    donefetching: document.getElementById('fetching-done-screen'),
    errorfetching: document.getElementById('fetching-error-screen'),
    erase: document.getElementById('erase-screen'),
    allcompleted: document.getElementById('all-completed-screen'),
};

const deviceName = document.getElementById('device-name');
const connectButton = document.getElementById('button-connect');
const disconnectButton = document.getElementById('button-disconnect');
const bluetoothIsAvailable = document.getElementById('bluetooth-is-available');
const bluetoothIsAvailableMessage = document.getElementById('bluetooth-is-available-message');
const connectBlock = document.getElementById('connect-block');
const downloadFiles = document.getElementById('file-list');

const getsizeButton = document.getElementById('button-getsize');
const cancelDownloadButton = document.getElementById('fetching-cancel');

const retryFetchingButton = document.getElementById('fetching-cancel-retry');

const downloadAllButton = document.getElementById('fetching-done-save-files');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');

const tmpdevicename = document.getElementById('device-name-tmp');
const preFetchingCD = document.getElementById('pre-fetching-cd');

const fetchingGauge = document.getElementById('fetching-gauge');
const fetchingPercentage = document.getElementById('fetching-percent');
const fetchingSpeed = document.getElementById('fetching-speed');

const fetchingRemainingTime = document.getElementById('fetching-remaining-time');

const popUp = document.getElementById('pop-up');
const popUpContent = document.getElementById('pop-up-content');
const popUpTrue = document.getElementById('pop-up-true');
const popUpFalse = document.getElementById('pop-up-false');


let file = new Uint8Array();

let swapScreen = (screen) => {
    screens.initial.style.display = 'none';
    screens.connecting.style.display = 'none';
    screens.connected.style.display = 'none';
    screens.connectionlost.style.display = 'none';
    screens.fetching.style.display = 'none';
    screens.cancelfetching.style.display = 'none';
    screens.donefetching.style.display = 'none';
    screens.errorfetching.style.display = 'none';
    screens.erase.style.display = 'none';
    screens.allcompleted.style.display = 'none';

    switch(screen) {
        case 'initial':
            screens.initial.style.display = 'block';
            break;
        case 'connecting':
            screens.connecting.style.display = 'block';
            break;
        case 'connected':
            screens.connected.style.display = 'block';
            break;
        case 'connectionlost':
            screens.connectionlost.style.display = 'block';
            break;
        case 'fetching':
            screens.fetching.style.display = 'block';
            break;
        case 'cancelfetching':
            screens.cancelfetching.style.display = 'block';
            break;
        case 'donefetching':
            screens.donefetching.style.display = 'block';
            break;
        case 'errorfetching':
            screens.errorfetching.style.display = 'block';
            break;
        case 'erase':
            screens.erase.style.display = 'block';
            break;
        case 'allcompleted':
            screens.allcompleted.style.display = 'block';
            break;
    }
};

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
    swapScreen('connecting');
});
mcumgr.onConnect(() => {
    let cd = 10;
    swapScreen('connected');
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
            swapScreen('fetching');
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
    console.log(e);
    let remaining = (e.maxSize - e.downloaded)/e.speed;
    if(remaining > 3600) {
        fetchingRemainingTime.innerText = 'More than '+  Math.floor(remaining/3600) + 'h ';
    } else if (remaining > 60) {
        fetchingRemainingTime.innerText = Math.floor(remaining/60) + 'm ';
    } else {
        fetchingRemainingTime.innerText = 'Less than 1m ';
    }
    fetchingGauge.style.width = (e.downloaded/e.maxSize)*100 + '%';
    fetchingPercentage.innerText = Math.round((e.downloaded/e.maxSize)*100) + '%';
    if(e.speed > 1000000) {
        fetchingSpeed.innerText = Math.round(e.speed/1000000) + ' MB/s';
    } else if(e.speed > 1000) {
        fetchingSpeed.innerText = Math.round(e.speed/1000) + ' KB/s';
    } else {
        fetchingSpeed.innerText = e.speed + ' B/s';
    }
});
mcumgr.onDisconnect((e) => {
    console.log('Disconnected');
    console.log(e);
    deviceName.innerText = 'Connect your device';
    swapScreen('initial');
});



connectButton.addEventListener('click', async () => {
    let filters = [{ namePrefix: 'NaoX' }];
    await mcumgr.connect(filters,file);
});

disconnectButton.addEventListener('click', async () => {
    mcumgr.disconnect();
});


/*downloadButton.addEventListener('click', async () => {
    mcumgr._download();
}); */
console.log('add event listener');
cancelDownloadButton.addEventListener('click', async () => {
    console.log('Cancel download');
    popUp.style.display = 'block';
    popUpContent.innerText = 'You are currently fetching files from the device. Are you sure you want to cancel this process?';
    popUpTrue.addEventListener('click', () => {
        popUp.style.display = 'none';
        mcumgr.cancel();
        swapScreen('cancelfetching');
    });
    popUpTrue.innerHTML = 'Yes, cancel fetching';
    popUpFalse.addEventListener('click', () => {
        popUp.style.display = 'none';
    });
    popUpFalse.innerHTML = 'No, keep fetching';
})
console.log(cancelDownloadButton);
retryFetchingButton.addEventListener('click', async () => {
    swapScreen('fetching');
    mcumgr._getFilesSizes();
});
mcumgr.onDoneDownload((e) => {
    fetchingGauge.style.width = '100%';
    fetchingRemainingTime.innerText = '0 s';
    fetchingPercentage.innerText = '100%';
    let testZip = new JSZip();
    for(let x = 0 ; x < Object.keys(e).length; x++){
        if(e[x].length > 0){
            let tmpFile = new Uint8Array(e[x]);
            let blob = new Blob([tmpFile],{type: 'application/octet-stream'});
            testZip.file(`EDF ${x}.edf`,blob);
        } else {
            
        }
    };
    testZip.generateAsync({type:"blob"}).then(function(content) {
        let url = URL.createObjectURL(content);
        downloadAllButton.href = url;
    }).then(async (content) => {
        if (window.showSaveFilePicker) {
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
        }
    });
});
