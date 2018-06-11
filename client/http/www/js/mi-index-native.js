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


    //2.连接到服务器
    let ws=new WebSocket('ws://localhost:1314/');

    ws.onopen = function (){
        alert('连接已打开');
        //触发BE发图片
        let buf = new ArrayBuffer(32);
        let buf_ = new Uint8Array(buf);
        for (let i = 0; i<10; ++i) {
            buf_[i] = i*2 + 3;    
        }
        ws.send(buf);
    };

    // ws.addEventListener('message', function (event) {
    //     console.log('Message from server ', event.data);
    // });

    ws.onmessage = function (evt){
        //alert(`有消息过来: ${evt.data.size}`);
        let reader = new FileReader();
        reader.onload = function(evt) {
            if (evt.target.readyState == FileReader.DONE) {
                let res = evt.target.result;
                let buf = new Uint8Array(res);
                for (let i=0; i<buf.byteLength; ++i) {
                    console.log(buf[i]);
                }
                alert(`有消息过来: ${buf}`);

                return;

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
            }
        }
        reader.readAsArrayBuffer(evt.data);
    };

    ws.onclose = function (){
        alert('连接已断开');
    };
    
    ws.onerror = function (){
        alert('连接出错');
    };
})();