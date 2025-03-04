
const screens = {
    initial: document.getElementById('initial-screen'),
    connecting: document.getElementById('connecting-screen'),
    connected: document.getElementById('connected-screen'),
    connectionfailed: document.getElementById('connection-failed-screen'),
    connectionlost: document.getElementById('connection-lost-screen'),
    nofiles: document.getElementById('no-files-screen'),
    fetching: document.getElementById('fetching-screen'),
    cancelfetching: document.getElementById('fetching-cancel-screen'),
    donefetching: document.getElementById('fetching-done-screen'),
    errorfetching: document.getElementById('fetching-error-screen'),
    erase: document.getElementById('erase-screen'),
    erasing: document.getElementById('erasing-screen'),
    allcompleted: document.getElementById('all-completed-screen'),
};

const deviceName = document.getElementById('device-name');

const connectButton = document.getElementById('button-connect');
const retryButton = document.getElementById('connection-lost-retry');
const failedRetryButton = document.getElementById('connection-failed-retry');
const disconnectButton = document.getElementById('button-disconnect');
const eraseButton = document.getElementById('erase-all');

const bluetoothIsAvailable = document.getElementById('bluetooth-is-available');
const bluetoothIsAvailableMessage = document.getElementById('bluetooth-is-available-message');
const connectBlock = document.getElementById('connect-block');
const downloadFiles = document.getElementById('file-list');

const getsizeButton = document.getElementById('button-getsize');
const cancelDownloadButton = document.getElementById('fetching-cancel');

const retryFetchingButton = document.getElementById('fetching-cancel-retry');
const errorFetchingButton = document.getElementById('fetching-error-fetch-remaining');

const downloadAllButton = document.getElementById('fetching-done-save-files');
const downloadAllAgainButton = document.getElementById('erase-redownload');

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');

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

const disconnectWindow = document.getElementById('disconnect-window');
const disconnectWindowDevice = document.getElementById('disconnect-window-device');

let file = new Uint8Array();

let echoResponse = false;

let swapScreen = (screen) => {
    screens.initial.style.display = 'none';
    screens.connecting.style.display = 'none';
    screens.connected.style.display = 'none';
    screens.connectionfailed.style.display = 'none';
    screens.connectionlost.style.display = 'none';
    screens.nofiles.style.display = 'none';
    screens.fetching.style.display = 'none';
    screens.cancelfetching.style.display = 'none';
    screens.donefetching.style.display = 'none';
    screens.errorfetching.style.display = 'none';
    screens.erase.style.display = 'none';
    screens.erasing.style.display = 'none';
    screens.allcompleted.style.display = 'none';

    switch(screen) {
        case 'initial':
            screens.initial.style.display = 'block';
            disconnectWindow.style.display = 'none';
            break;
        case 'connecting':
            screens.connecting.style.display = 'block';
            disconnectWindow.style.display = 'none';
            break;
        case 'connected':
            screens.connected.style.display = 'block';
            disconnectWindow.style.display = 'flex';
            break;
        case 'nofiles':
            screens.nofiles.style.display = 'block';
            disconnectWindow.style.display = 'flex';
            break;
        case 'connectionfailed':
            screens.connectionfailed.style.display = 'block';
            break;
        case 'connectionlost':
            screens.connectionlost.style.display = 'block';
            if(disconnectWindow.style.display === 'flex') disconnectWindow.style.display = 'none';
            break;
        case 'fetching':
            screens.fetching.style.display = 'block';
            break;
        case 'cancelfetching':
            screens.cancelfetching.style.display = 'block';
            break;
        case 'donefetching':
            screens.donefetching.style.display = 'block';
            step1.innerHTML ='<image src="img/check.svg" alt="Step 1 done">';
            step1.className = 'step';
            step2.innerHTML ='<div>2</div>';
            step2.className = 'step active';
            break;
        case 'errorfetching':
            screens.errorfetching.style.display = 'block';
            break;
        case 'erase':
            step2.innerHTML ='<image src="img/check.svg" alt="Step 1 done">';
            step2.className = 'step';
            step3.innerHTML ='<div>3</div>';
            step3.className = 'step active';
            screens.erase.style.display = 'block';
            break;
        case 'erasing':
            screens.erasing.style.display = 'block';
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
    mcumgr._getFilesSizes();
});
mcumgr.onGotMaxSize((e) => {
    console.log(e);
    if(e > 0) {
        setTimeout(() => {
            let cd = 5;
            swapScreen('connected');
            tmpdevicename.innerText = mcumgr._device.name;
            disconnectWindowDevice.innerText = mcumgr._device.name;
            preFetchingCD.innerText = cd;
            disconnectButton.style.display = 'block';
            let interval = setInterval(() => {
                if(cd > 0) {
                    cd--;
                    preFetchingCD.innerText = cd;
                } else {
                    clearInterval(interval);
                    swapScreen('fetching');
                    mcumgr._download();
                }
            }, 1000);
        }, 5000);
    } else if(e === 0) {
        document.getElementById('no-files-device-name-tmp').innerText = mcumgr._device.name;
        disconnectWindowDevice.innerText = mcumgr._device.name;
        disconnectButton.style.display = 'block';
        swapScreen('nofiles');
    }
});

mcumgr.onErase((e) => {
    console.log('Erase done');
    console.log(e);
    if(e === true) {
        swapScreen('erasing');
        console.log('echoResponse',echoResponse);
        if(echoResponse !== true) {
            let loop = setInterval(() => {
                console.log('loop',echoResponse);
                console.log(loop);
                if(echoResponse === true) {
                    clearInterval(loop);
                    swapScreen('allcompleted');
                    window.addEventListener('unload', releaseWakeLock);
                    echoResponse = false;
                } else {
                    mcumgr.smpEcho();
                }
            },10000);
        } else if (echoResponse === true) {
            swapScreen('allcompleted');
            window.addEventListener('unload', releaseWakeLock);
            echoResponse = false;
        }
    }
});

mcumgr.onEcho((e) => {
    console.log(e);
    if(e !== undefined) {
        console.log('Echo response');
        echoResponse = true;
    }
});

mcumgr.onFetching(async (e) => {
    console.log('Fetching ...');
    let remaining = (e.maxSize - e.downloaded)/e.speed;
    if(remaining > 3600) {
        fetchingRemainingTime.innerText = 'Remaining time : More than '+  Math.floor(remaining/3600) + 'h ';
    } else if (remaining > 60) {
        fetchingRemainingTime.innerText = 'Remaining time : '+ Math.floor(remaining/60) + 'min ';
    } else {
        fetchingRemainingTime.innerText = 'Remaining time : Less than 1 min ';
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

mcumgr.onFetchError((e) => {
    console.log(e);
    swapScreen('errorfetching');
});
mcumgr.onDisconnect((e) => {
    step1.innerHTML ='<div>1</div>';
    step1.className = 'step active';
    step2.innerHTML ='<div></div>';
    step2.className = 'step';
    step3.innerHTML ='<div></div>';
    step3.className = 'step';
    swapScreen('initial');
});


mcumgr.onErrorDisconnected((e) => {
    console.log(e); 
    swapScreen('connectionlost');
});

mcumgr.onConnectFailed((e) => {
    console.log(e);
    swapScreen('connectionfailed');
});
let connectButtons = [connectButton,retryButton,failedRetryButton];

connectButtons.forEach((button) => {
    button.addEventListener('click', async () => {
        let filters = [{ namePrefix: 'NaoX' }];
        await mcumgr.connect(filters);
    });
});

disconnectButton.addEventListener('click', async () => {
    if(!mcumgr.fetchingStatus){
        popUp.style.display = 'block';
        popUpContent.innerText = 'Are you sure you want to disconnect your device?';
        popUpTrue.addEventListener('click', () => {
            popUp.style.display = 'none';

            mcumgr.disconnect();
        });
        popUpTrue.innerHTML = 'Disconnect';
        popUpFalse.addEventListener('click', () => {
            popUp.style.display = 'none';
        });
        popUpFalse.innerHTML = 'Cancel';
    }
});


errorFetchingButton.addEventListener('click', async () => {
    swapScreen('fetching');
    mcumgr._download();
});
cancelDownloadButton.addEventListener('click', async () => {
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
retryFetchingButton.addEventListener('click', async () => {
    swapScreen('fetching');
    mcumgr._getFilesSizes();
});
mcumgr.onDoneDownload((e) => {
    if(e.status === 0 || e.status === 5) {
        fetchingGauge.style.width = '100%';
        fetchingRemainingTime.innerText = '0 s';
        fetchingPercentage.innerText = '100%';
        let testZip = new JSZip();
        for(let x = 0 ; x < Object.keys(e.files).length; x++){
            if(e.files[x].length > 0){
                let tmpFile = new Uint8Array(e.files[x]);
                let blob = new Blob([tmpFile],{type: 'application/octet-stream'});
                testZip.file(`EDF ${x}.edf`,blob);
            }
        };
        testZip.generateAsync({type:"blob"}).then(function(content) {
            let url = URL.createObjectURL(content);
            downloadAllButton.href = url;
            let filename = `${document.getElementById('disconnect-window-device').innerText}_${new Date().toISOString().split('T')[0]}.zip`;
            downloadAllButton.download = filename;
            downloadAllAgainButton.href = url;
            downloadAllAgainButton.download = filename;
        })

        downloadAllButton.addEventListener('click', async (e) => {
            setTimeout(() => {
                swapScreen('erase');
            }, 5000);
        });
        swapScreen('donefetching');
    } else if(e.status !== undefined) {
        swapScreen('errorfetching');
    }
});
eraseButton.addEventListener('click', async () => {
    await mcumgr.clearDevice();
});


// Vérifiez si l'API Wake Lock est disponible
if ('wakeLock' in navigator) {
    let wakeLock = null;
  
    // Fonction pour demander le Wake Lock
    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    };
  
    // Fonction pour libérer le Wake Lock
    const releaseWakeLock = async () => {
      if (wakeLock !== null) {
        try {
          await wakeLock.release();
          wakeLock = null;
          console.log('Wake Lock désactivé');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
        }
      }
    };
  
    // Demander le Wake Lock lorsque la page est chargée
    document.addEventListener('DOMContentLoaded', requestWakeLock);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          requestWakeLock();
        }
    });
    // Libérer le Wake Lock lorsque la page est déchargée
    //window.addEventListener('unload', releaseWakeLock);
  } else {
    console.log('Wake Lock API non supportée');
  }
  