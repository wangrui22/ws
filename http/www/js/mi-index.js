(function() {
    let canvas = $('#c1')[0];
    const width = 512;
    const height = 512;
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');
    let img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0,0,width,height);
    }
    img.src = 'mb.jpeg';

    alert('OK')
})();