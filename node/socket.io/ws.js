const express = require('express');
const app = express();
const http = require('http').Server(app);
const fs = require('fs');

//const io = require('socket.io')(http, {transports:['polling'], httpCompression:false});
//const io = require('socket.io')(http, {transports:['websocket', 'polling'], httpCompression:false});
const io = require('socket.io')(http, {transports:['polling'], httpCompression:false});
//const io = require('socket.io')(http, {transports:['websocket'], httpCompression:false});
/*  */

http.listen(1314);

io.on('connection', socket =>{
    console.log('ws connect');
    const IMG_SIZE = 359;
    socket.no = 0;
    socket.bw = 0;    
    socket.bw_time = Date.now();
    socket.fn = setInterval(function() {
        socket.no += 1;
        if(socket.no > IMG_SIZE) {
            socket.bw = socket.bw /1024/1024 / (Date.now() - socket.bw_time) * 1000.0;
            console.log(`server bw: ${socket.bw} mb/s`);
            socket.no = 1;
            socket.bw = 0;    
            socket.bw_time = Date.now();
        }
        const img_file = `../../client/http/www/img/img_${socket.no}.jpeg`;
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
                
                socket.emit('data', buf);
                socket.emit('data',data);

                //console.log(`emit img ${img_file}, size: ${len}.`);

                socket.bw += len+32;                
            }
        });
    },10);

    socket.on('init', data=>{
        console.log(`init: ${data}`);
    });

    socket.on('message', msg=> {
        console.log(`message: ${msg}`);
    });

    socket.on('data', data=>{
        console.log('data');
    });

    socket.on('disconnect', function() {
        //disconnect  
        console.log('ws disconnect');
        clearInterval(socket.fn);
    });
});