const net=require('net');
const crypto=require('crypto');
const fs = require('fs');

function makeBinFrameHeader() {
    const bufLen = buf.byteLength;
    let header = null;
    let headerLen = 0;
    if (bufLen < 125) {
        headerLen = (1 + 3 + 4 + 1 + 7)/8; //2 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = bufLen;
    } else if(bufLen < 65535) {
        headerLen = (1 + 3 + 4 + 1 + 7 + 16)/8; //4 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = 126;
        header.writeUInt16BE(bufLen,2);
    } else  {
        headerLen = (1 + 3 + 4 + 1 + 7 + 64)/8; // 7 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = 127;
        //header.writeUInt32BE(bufLen << 32 & 0xffff, 2);
        header.writeUInt32BE(bufLen, 2+4);
    }
    return header;
}

function constructFrame(...bufs) {
    let bufLen = 0;
    for (let i=0; i<bufs.length; ++i) {
        bufLen += bufs[i].byteLength;
    }
    let header = null;
    let headerLen = 0;
    if (bufLen < 125) {
        headerLen = (1 + 3 + 4 + 1 + 7)/8; //2 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = bufLen;
    } else if(bufLen < 65535) {
        headerLen = (1 + 3 + 4 + 1 + 7 + 16)/8; //4 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = 126;
        header.writeUInt16BE(bufLen,2);
    } else  {
        headerLen = (1 + 3 + 4 + 1 + 7 + 64)/8; // 7 bytes
        header = new Buffer(headerLen);
        header[0] = 0x80 | 0x00 | 0x02;
        header[1] = 127;
        header.writeUInt32BE(bufLen , 2+4);
    }

    let res = Buffer.alloc(bufLen + header.byteLength);
    header.copy(res, 0, 0, header.byteLength);
    let offset = 0;
    for (let i=0; i<bufs.length; ++i) {
        bufs[i].copy(res, header.byteLength + offset ,0, bufs[i].byteLength);
        offset = bufs[i].byteLength;
    }
    return res;
}


//1.创建一个tcp服务器
let server=net.createServer(socket => {
    console.log('有人连接我了');

    //3.接收浏览器发过来的特殊头，处理、返回处理结果\
    socket.once('data', data=>{
    //第一次

    //第一步、把数据转换成headers的json
    let str=data.toString();
    let aHeaders=str.split('\r\n');

    aHeaders.shift();
    aHeaders.pop();
    aHeaders.pop();

    let headers={};

    aHeaders.forEach(str=>{
      let [name, value]=str.split(': ');

      headers[name]=value;
    });

    //第二步、校验
    const isChrome = (headers['Connection']=='Upgrade' && headers['Upgrade']=='websocket');
    const isFireFox = (headers['Connection']=='keep-alive, Upgrade' && headers['Upgrade']=='websocket');
    if(!isChrome && !isFireFox){
      console.log('接到了一个ws以外的协议，扔了');
      socket.end();
    }else{
      //第三步、处理websocket专有头
      if(headers['Sec-WebSocket-Version']!=13){
        console.log('出现了意外的的ws版本');
        socket.end();
      }else{
        //第四步、处理key
        //C -> S        "Sd8iRCUKYSU1rEiD+GNMqg=="
        //S -> C        base64(sha1("Sd8iRCUKYSU1rEiD+GNMqg=="+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))

        let hash=crypto.createHash('sha1');

        hash.update(headers['Sec-WebSocket-Key']+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
        let base64Key=hash.digest('base64');

        //base64Key=>client
        socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${base64Key}\r\n\r\n`);

        console.log('握手完成');

        const buf = Buffer.alloc(32);
        socket.write(buf);
        console.log(`send buffer ${buf.byteLength} to client.`);
      }

      //console.log(headers);
    
      //后续
      let sumData = 0;
      socket.on('data', (data)=>{
        //这里会有粘包的问题，需要拼接起来
        //解析帧结构
        sumData += data.byteLength;
        console.log(`recv client data: ${data.byteLength}, sum client data: ${sumData}`);
        //return;

        let offset = 0;    
        offset += 2;
        // for (let i=0; i<4; ++i) {
        console.log(`data[${0}] = ${data[0]}`);
        // }
        const fin = (data[0] >> 7) & 0x01;
        const rsv1 = (data[0] >> 6) & 0x01;
        const rsv2 = (data[0] >> 5) & 0x01;
        const rsv3 = (data[0] >> 4) & 0x01;
        const opcode = (data[0]) & 0x0f; 
        const mask = (data[1] >> 7) & 0x01;
        const payloadLen0 = (data[1] & 0x7f);
        let payloadLen = payloadLen0;
        if (payloadLen0 == 126) {
            payloadLen = data.readUInt16BE(offset,1);
            offset += 2;
        } else if (payloadLen0 == 127) {
            //let a = data.readUInt32BE(offset,1);
            let b = data.readUInt32BE(offset+4,1);
            payloadLen = b;
            offset += 8;
        }

        //console.log(`FIN ${fin}`);
        //console.log(`Opcode ${opcode}`);
        //console.log(`Payload length ${payloadLen}`)
        //return;

        let maskKey = 0;
        let maskKeys = [];
        if (mask == 1) {
            maskKeys.push(data[offset]);
            maskKeys.push(data[offset+1]);
            maskKeys.push(data[offset+2]);
            maskKeys.push(data[offset+3]);
            maskKey = data.readUInt32BE(offset,1)
            offset += 4;
        }

        console.log(`FIN ${fin}`);
        console.log(`RSV1 ${rsv1}`);
        console.log(`RSV2 ${rsv2}`);
        console.log(`RSV3 ${rsv3}`);
        console.log(`Opcode ${opcode}`);
        console.log(`Mask ${mask}`);
        console.log(`Payload length ${payloadLen}`)
        console.log(`Mask Key ${maskKey}`);
        console.log(`Mask Key 0 ${maskKeys[0]}`);
        console.log(`Mask Key 1 ${maskKeys[1]}`);
        console.log(`Mask Key 2 ${maskKeys[2]}`);
        console.log(`Mask Key 3 ${maskKeys[3]}`);

        // img_file = `/home/wangrui22/projects/ws/client/http/www/img/img_1.jpeg`;
        //     fs.readFile(img_file, (err, data)=>{
        //         if(err) {
        //             console.log(`read ${img_file} failed.`);
        //         } else {
        //             const len = data.byteLength;
        //             const buf = new Buffer(32);
        //             buf.writeUIntLE(1, 0, 4);
        //             buf.writeUIntLE(0, 4, 4);
        //             buf.writeUIntLE(0, 8, 4);
        //             buf.writeUIntLE(0, 12, 4);
        //             buf.writeUIntLE(0, 16, 4);
        //             buf.writeUIntLE(0, 20, 4);
        //             buf.writeUIntLE(0, 24, 4);
        //             buf.writeUIntLE(len, 28, 4);
                
        //             let res = constructFrame(buf,data);
        //             socket.write(res);

        //             console.log(`emit img ${img_file}, size: ${len}.`);
        //         }
        //     });

        //---------------------------------------//
        //socket.write(data);

        //send a test buffer to FE
        // let msgBuffer = Buffer.alloc(4);
        // for (let i=0; i<msgBuffer.byteLength; ++i) {
        //     msgBuffer[i] = i;
        // }
        // let resHeader = makeBinFrameHeader(msgBuffer);
        // let resBuffer = Buffer.alloc(msgBuffer.byteLength + resHeader.byteLength);
        // resHeader.copy(resBuffer, 0, 0, resHeader.byteLength);
        // msgBuffer.copy(resBuffer, resHeader.byteLength,0, msgBuffer.byteLength);
        // console.log(`write buffer ${resBuffer.byteLength}`);
        // for (let i=0; i<resBuffer.byteLength; ++i) {
        //     console.log(`send to client data[${i}]: ${resBuffer[i]}`);
        // }

        // socket.write(resBuffer);

        //socket.write(resHeader);
        //socket.write(msgBuffer);

        //---------------------------------------//

      

        

        const IMG_SIZE = 71;
        socket.no = 0;
        socket.fn = setInterval(function() {
            socket.no += 1;
            if(socket.no > IMG_SIZE) {
                socket.no = 0;
            }
            const img_file = `/home/wangrui22/projects/ws/client/http/www/img/img_${socket.no}.jpeg`;
            fs.readFile(img_file, (err, data)=>{
                if(err) {
                    console.log(`read ${img_file} failed.`);
                } else {
                    const len = data.byteLength;
                    const buf = new Buffer(32);
                    buf.writeUIntLE(1, 0, 4);
                    buf.writeUIntLE(0, 4, 4);
                    buf.writeUIntLE(0, 8, 4);
                    buf.writeUIntLE(0, 12, 4);
                    buf.writeUIntLE(0, 16, 4);
                    buf.writeUIntLE(0, 20, 4);
                    buf.writeUIntLE(0, 24, 4);
                    buf.writeUIntLE(len, 28, 4);
                
                    let res = constructFrame(buf,data);
                    socket.write(res);

                    console.log(`emit img ${img_file}, size: ${len}.`);
                }
            });
        },10);


        
      });
    }
  });

  socket.on('end', ()=>{
    console.log('连接已断开');
    clearInterval(socket.fn);
  });
});
server.listen(1314);