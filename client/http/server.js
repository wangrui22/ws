const http = require('http');
const url = require('url');
const fs = require('fs');

server = http.createServer((req,res)=>{
    const {path} = url.parse(req.url);
    console.log(path);
    fs.readFile(`www${path}`, (err, data)=>{
        if (err) {
            res.write('not found');
            res.end();
        } else {
            res.write(data);
            res.end();
        }
    }); 
});

server.listen(8080);

