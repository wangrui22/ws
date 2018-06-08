(function() {
    let socketClient = new SocketClient();

    let canvas = $('#c1')[0];
    const width = 1024;
    const height = 1024;
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');
    let img = new Image();
    let jpegStr = '';
    img.onload = function() {
        ctx.drawImage(img, 0,0,width,height);
    }

    //Render performance
    let frame = 0;
    let fps = 0;
    let frameTime = Date.now();

    //RPC transmit performance
    let pkgSize = 0;
    let bw = 0;

    const socket = io.connect(`ws://127.0.0.1:1314`);
    
    socket.emit('init', {context:'hello'});
    
    socket.on('message', msg=>{
        console.log(data);
    });

    socket.on('data', data=>{
        socketClient.recvData(data, function(cmdID, cellID, opID, buffer, bufferOffset, dataLen, restDataLen, withHeader) {
            if (withHeader) {
                jpegStr = '';
            } 

            //64KB cycle
            const KB64 = 64*1024;
            while (dataLen > KB64) {
                let imgBuffer = new Uint8Array(buffer, bufferOffset, KB64);
                jpegStr += String.fromCharCode.apply(null, imgBuffer);
                dataLen -= KB64;
                bufferOffset += KB64;
            }
            if (dataLen > 0) {
                let imgBuffer = new Uint8Array(buffer, bufferOffset, dataLen);
                jpegStr += String.fromCharCode.apply(null, imgBuffer);
                dataLen = 0;
            }

            if(restDataLen <= 0) {
                //console.log(`image len: ${this.jpegStr.length/1024} kb`);
                img.src =  'data:image/jpg;base64,' + btoa(jpegStr);
    
                //FPS && Bandwidth
                if (frame == 0) {
                    frameTime = Date.now();
                    pkgSize = 0;
                }
                frame += 1;
                pkgSize += jpegStr.length/1024;
                if(frame >= 100) {
                    const t0 = frameTime;
                    const t1 = Date.now();
                    const f = frame;
                    const s = pkgSize;
                    frameTime = t1;
                    frame = 0;
                    fps = f / (t1 - t0) * 1000.0;
                    bw = (s / (t1 - t0)) * 1000.0 / 1024.0;
                    console.log(`FPS: ${fps}, bw: ${bw} mb/s`);
                    $('#fps').html(` FPS: ${fps}`);
                }
            }                    
        });
    });
})();