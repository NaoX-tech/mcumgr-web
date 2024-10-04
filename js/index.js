const screens = {
    initial: document.getElementById('initial-screen'),
    connecting: document.getElementById('connecting-screen'),
    connected: document.getElementById('connected-screen')
};

const deviceName = document.getElementById('device-name');
const deviceNameInput = document.getElementById('device-name-input');
const connectButton = document.getElementById('button-connect');
const disconnectButton = document.getElementById('button-disconnect');
const bluetoothIsAvailable = document.getElementById('bluetooth-is-available');
const bluetoothIsAvailableMessage = document.getElementById('bluetooth-is-available-message');
const connectBlock = document.getElementById('connect-block');
const downloadButton = document.getElementById('button-download');
const downloadFiles = document.getElementById('file-list');

let file = new Uint8Array();

if (navigator && navigator.bluetooth && navigator.bluetooth.getAvailability()) {
    bluetoothIsAvailableMessage.innerText = 'Bluetooth is available in your browser.';
    bluetoothIsAvailable.className = 'alert alert-success';
    connectBlock.style.display = 'block';
} else {
    bluetoothIsAvailable.className = 'alert alert-danger';
    bluetoothIsAvailableMessage.innerText = 'Bluetooth is not available in your browser.';
}

let fileData = null;
let images = [];

deviceNameInput.value = localStorage.getItem('deviceName');
deviceNameInput.addEventListener('change', () => {
    localStorage.setItem('deviceName', deviceNameInput.value);
});

const mcumgr = new MCUManager();
mcumgr.onConnecting(() => {
    console.log('Connecting...');
    screens.initial.style.display = 'none';
    screens.connected.style.display = 'none';
    screens.connecting.style.display = 'block';
});
mcumgr.onConnect(() => {
    deviceName.innerText = mcumgr.name;
    screens.connecting.style.display = 'none';
    screens.initial.style.display = 'none';
    screens.connected.style.display = 'block';
    mcumgr.cmdImageState();
});
mcumgr.onDisconnect(() => {
    deviceName.innerText = 'Connect your device';
    screens.connecting.style.display = 'none';
    screens.connected.style.display = 'none';
    screens.initial.style.display = 'block';
});

connectButton.addEventListener('click', async () => {
    let filters = null;
    if (deviceNameInput.value) {
        filters = [{ namePrefix: deviceNameInput.value }];
    };
    await mcumgr.connect(filters,file);
});

disconnectButton.addEventListener('click', async () => {
    mcumgr.disconnect();
});


downloadButton.addEventListener('click', async () => {
    mcumgr._download();
});

mcumgr.onDoneDownload((e) => {
    downloadFiles.innerHTML = '';
    for(let x = 0 ; x < Object.keys(e).length; x++){
        if(e[x].length > 0){
            let tmpFile = new Uint8Array(e[x]);
            let blob = new Blob([tmpFile],{type: 'application/octet-stream'});
            let url = URL.createObjectURL(blob);
            const div = document.createElement('div');
            div.innerHTML = `<a href="${url}" download="EDF ${x}">EDF ${x}</a>`;
            downloadFiles.appendChild(div);
        } else {
            
        }
    };

});
