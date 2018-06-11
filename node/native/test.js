function fn(...bufs) {
    for(let i=0; i<bufs.length; ++i) {
        console.log(bufs[i].byteLength);
    }
}

let x = Buffer.alloc(32);
let y = Buffer.alloc(20);
let z = Buffer.alloc(100);
fn(x,y,z);