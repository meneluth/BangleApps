let timer = null;
let remaining = 0;
let activeQuad = null;
let mode; // grid, countdown
const middle = 88;
const reloadIcon = {
    x1: middle - 16,
    y1: 135 - 16,
    x2: middle + 16,
    y2: 135 + 16,
    imageObject: {
        width: 32, height: 32, bpp: 3,
        transparent: 1,
        buffer: atob("JJJJJJAAABJJJJJJJJJJIAAAAAAJJJJJJJJJAAAAAAAAJJJJJJJAAAAAAAAAAJJJJJIAAAAAAAAAABJJJJAAAAAJJIAAAAJJJIAAABJJJJIAAABJJIAABJJJJJJIAABJJAAAJJJJJJJJAAAJIAABJJJJJJJJIAAJIAABJJJJJJJJIAABIAAJJJJJJJJJJAABAAAJJJJJJJJJJIABAAAJJJJJJJJJJJBJAABJJJJJJJJJJJJJAABJJJJJJJJJJJJJAABJJJJJJJJJJJJJAABJJJJJJJJJJJJJAAAJJJJJJJJAAAAJAAAJJJJJJJAAAAAAIAAJJJJJJJAAAAAAIAABJJJJJJAAAAAAIAABJJJJJJAAAAAAJAAAJJJJJJJAAAAAJAAABJJJJJJIAAAAJIAAABJJJJIAAAAAJJAAAAAJJAAAAAAAJJIAAAAAAAAAAAAAJJJAAAAAAAAAAIAAJJJJAAAAAAAAJIAAJJJJIAAAAAABJJABJJJJJJAAAAJJJJJJ")
    }
}

const quadrants = [
    {label: '20"', sec: 20, x1: 0, y1: 0, x2: 87, y2: 87, bg: '#e60000', text: '#ffffff'}, // Rosso (Alto Sx)
    {label: '30"', sec: 30, x1: middle, y1: 0, x2: 175, y2: 87, bg: '#0055ff', text: '#ffffff'}, // Blu (Alto Dx)
    {label: '60"', sec: 60, x1: 0, y1: middle, x2: 87, y2: 175, bg: '#ffcc00', text: '#000000'}, // Giallo (Basso Sx)
    {label: '90"', sec: 90, x1: middle, y1: middle, x2: 175, y2: 175, bg: '#00aa33', text: '#ffffff'}  // Verde (Basso Dx)
];

function drawGrid() {
    mode = "grid";
    g.clear();
    quadrants.forEach(q => {
        g.setColor(q.bg);
        g.fillRect(q.x1, q.y1, q.x2, q.y2);

        g.setColor(0, 0, 0);
        g.drawRect(q.x1, q.y1, q.x2, q.y2);

        g.setColor(q.text);
        g.setFont("Vector", 32);
        g.setFontAlign(0, 0);
        g.drawString(` ${q.label}`, (q.x1 + q.x2) / 2, (q.y1 + q.y2) / 2);
    });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function renderCountdown() {
    mode = "countdown";
    g.setColor('#ffffff');
    g.fillRect(0, 0, 175, 175);

    g.setColor('#000000');
    g.setFontAlign(0, 0);
    g.setFont("Vector", 14);
    g.drawString(formatTime(activeQuad.sec), middle, 25);

    g.setFont("Vector", 56);
    g.drawString(formatTime(remaining), middle, 75);

    g.drawImage(reloadIcon.imageObject, reloadIcon.x1, reloadIcon.y1);
}

function startTimer(q) {
    if (timer) {
        clearInterval(timer);
    }
    activeQuad = q;
    remaining = q.sec;

    notifyUser();
    renderCountdown();

    timer = setInterval(() => {
        remaining--;
        renderCountdown();
        if (remaining <= 0) {
            clearInterval(timer);
            timer = null;
            endTimer();
        }
    }, 1000);
}

function endTimer() {
    Bangle.buzz(300).then(() =>
        setTimeout(() => Bangle.buzz(300).then(() =>
            setTimeout(() => Bangle.buzz(300), 300)
        ), 300)
    );
}

function notifyUser() {
    Bangle.buzz(50);
}

function isPointInRect(x, y, rect) {
    return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
}

Bangle.on("touch", (zone, e) => {
    switch (mode) {
        case "countdown":
            // Reload the timer if the user taps the repeat button
            if (isPointInRect(e.x, e.y, reloadIcon)) {
                startTimer(activeQuad);
                return;
            }
            if (timer) {
                clearInterval(timer);
                timer = null;
                notifyUser();
            }
            drawGrid();
            break;
        case "grid":
            quadrants.forEach(q => {
                if (isPointInRect(e.x, e.y, q)) {
                    startTimer(q);
                }
            });
            break;
    }
});

setWatch(() => {
    if (timer) {
        clearInterval(timer);
    }
    Bangle.showLauncher();
}, BTN1, {repeat: false, edge: "falling"});

drawGrid();