const TIMERS = [
    {seconds: 20, background: "#ff0000", foreground: "#ffffff"},
    {seconds: 30, background: "#0000ff", foreground: "#ffffff"},
    {seconds: 60, background: "#ffff00", foreground: "#000000"},
    {seconds: 90, background: "#00c000", foreground: "#ffffff"}
];

// Smooth scalable font: far more readable than a scaled-up bitmap font.
const FONT = "Vector";
const MIN_FONT_SIZE = 8;

// Fraction of a box the text is allowed to occupy, leaving a visual margin.
const WIDTH_RATIO = 0.85;
const HEIGHT_RATIO = 0.8;

// Share of the countdown screen given to the digits; the rest carries the
// small reminder of the value the timer started from.
const COUNTDOWN_SPLIT = 0.74;
// Upper bound for the reminder size, relative to the digits above it.
const REMINDER_RATIO = 0.5;

const defaultLcdTimeout = Bangle.getOptions().timeout;
const inkCache = {};

let view = "grid";
let activeTimer = null;
let remainingSeconds = 0;
let ticker = null;

/** Grid labels always read as plain seconds. */
const gridLabel = (seconds) => `${seconds}"`;

/** Countdown labels always read as mm:ss, e.g. 00:20, 01:30. */
const countdownLabel = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes < 10 ? "0" : ""}${minutes}:${rest < 10 ? "0" : ""}${rest}`;
};

const boxes = () => {
    const width = g.getWidth();
    const height = g.getHeight();
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    return [
        {timer: TIMERS[0], x1: 0, y1: 0, x2: midX - 1, y2: midY - 1},
        {timer: TIMERS[1], x1: midX, y1: 0, x2: width - 1, y2: midY - 1},
        {timer: TIMERS[2], x1: 0, y1: midY, x2: midX - 1, y2: height - 1},
        {timer: TIMERS[3], x1: midX, y1: midY, x2: width - 1, y2: height - 1}
    ];
};

const fullScreenBox = () => (
    {x1: 0, y1: 0, x2: g.getWidth() - 1, y2: g.getHeight() - 1}
);

/**
 * Largest vector font size at which `text` still fits inside the given bounds.
 * The size is a pixel height, so start from the height limit and shrink
 * proportionally until the width fits too.
 */
const fitSize = (text, maxWidth, maxHeight) => {
    let size = Math.max(MIN_FONT_SIZE, Math.floor(maxHeight));
    for (let attempt = 0; attempt < 4; attempt++) {
        g.setFont(FONT, size);
        const width = g.stringWidth(text);
        if (width <= maxWidth || size <= MIN_FONT_SIZE) {
            break;
        }
        size = Math.max(MIN_FONT_SIZE, Math.floor((size * maxWidth) / width));
    }
    return size;
};

/**
 * Centre of the pixels the string actually paints, relative to its draw
 * origin. Font metrics reserve room for ascenders, descenders and side
 * bearings that digits never use, so aligning on them leaves the text looking
 * off-centre. Measuring the real ink offscreen fixes both axes at once.
 */
const inkCentre = (text, size) => {
    const key = `${text}@${size}`;
    if (inkCache[key]) {
        return inkCache[key];
    }

    g.setFont(FONT, size);
    const width = Math.max(1, g.stringWidth(text)) + 2;
    const height = Math.max(1, g.getFontHeight()) + 2;
    let centre = {x: width / 2, y: height / 2};

    try {
        const canvas = Graphics.createArrayBuffer(width, height, 1, {msb: true});
        canvas.setFont(FONT, size);
        canvas.setFontAlign(-1, -1);
        canvas.drawString(text, 0, 0);

        const pixels = new Uint8Array(canvas.buffer);
        const stride = (width + 7) >> 3;
        let minByte = stride;
        let maxByte = -1;
        let minY = height;
        let maxY = -1;

        // First pass works on whole bytes only: bit twiddling every pixel is far
        // too slow on the watch and would stall the upload.
        for (let y = 0; y < height; y++) {
            const row = y * stride;
            for (let index = 0; index < stride; index++) {
                if (!pixels[row + index]) continue;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (index < minByte) minByte = index;
                if (index > maxByte) maxByte = index;
            }
        }

        if (maxByte >= 0) {
            // Refine the horizontal bounds inside the two outermost byte columns.
            let leftBits = 0;
            let rightBits = 0;
            for (let y = minY; y <= maxY; y++) {
                leftBits |= pixels[y * stride + minByte];
                rightBits |= pixels[y * stride + maxByte];
            }
            let firstBit = 0;
            while (firstBit < 7 && !(leftBits & (0x80 >> firstBit))) firstBit++;
            let lastBit = 7;
            while (lastBit > 0 && !(rightBits & (0x80 >> lastBit))) lastBit--;

            const minX = minByte * 8 + firstBit;
            const maxX = maxByte * 8 + lastBit;
            centre = {x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2};
        }
    } catch (e) {
        // Offscreen buffer unavailable: keep the font-metrics approximation.
    }

    inkCache[key] = centre;
    return centre;
};

const drawLabel = (text, box, color, size) => {
    const ink = inkCentre(text, size);
    g.setFont(FONT, size);
    g.setFontAlign(-1, -1);
    g.setColor(color);
    g.drawString(
        text,
        (box.x1 + box.x2 + 1) / 2 - ink.x,
        (box.y1 + box.y2 + 1) / 2 - ink.y
    );
};

const fillBox = (box, color) => {
    g.setColor(color);
    g.fillRect(box.x1, box.y1, box.x2, box.y2);
};

const drawGrid = () => {
    g.clear();
    boxes().forEach((box) => {
        const text = gridLabel(box.timer.seconds);
        const width = (box.x2 - box.x1 + 1) * WIDTH_RATIO;
        const height = (box.y2 - box.y1 + 1) * HEIGHT_RATIO;
        fillBox(box, box.timer.background);
        drawLabel(text, box, box.timer.foreground, fitSize(text, width, height));
    });
    g.flip();
};

const drawCountdown = () => {
    const screen = fullScreenBox();
    const split = Math.floor((screen.y2 + 1) * COUNTDOWN_SPLIT);
    const digitsBox = {x1: screen.x1, y1: screen.y1, x2: screen.x2, y2: split - 1};
    const startBox = {x1: screen.x1, y1: split, x2: screen.x2, y2: screen.y2};
    const maxWidth = (screen.x2 + 1) * WIDTH_RATIO;

    // Size from the starting value, which is always the widest label of the run,
    // so the digits keep one size from start to finish.
    const digitsSize = fitSize(
        countdownLabel(activeTimer.seconds),
        maxWidth,
        (digitsBox.y2 - digitsBox.y1 + 1) * HEIGHT_RATIO
    );
    const startText = countdownLabel(activeTimer.seconds);
    const startSize = Math.max(MIN_FONT_SIZE, Math.min(
        fitSize(startText, maxWidth, (startBox.y2 - startBox.y1 + 1) * HEIGHT_RATIO),
        Math.round(digitsSize * REMINDER_RATIO)
    ));

    g.clear();
    fillBox(screen, activeTimer.background);
    drawLabel(
        countdownLabel(remainingSeconds), digitsBox, activeTimer.foreground, digitsSize
    );
    drawLabel(startText, startBox, activeTimer.foreground, startSize);
    g.flip();
};

const stopTicker = () => {
    if (ticker === null) {
        return;
    }
    clearInterval(ticker);
    ticker = null;
};

const showGrid = () => {
    stopTicker();
    Bangle.setLCDTimeout(defaultLcdTimeout);
    activeTimer = null;
    view = "grid";
    drawGrid();
};

const notify = () => {
    Bangle.beep();
    Bangle.buzz();
}

const startCountdown = (timer) => {
    Bangle.setLCDTimeout(0);
    activeTimer = timer;
    remainingSeconds = timer.seconds;
    view = "countdown";
    drawCountdown();

    ticker = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            stopTicker();
            drawCountdown();
            notify();
            return;
        }
        drawCountdown();
    }, 1000);
};

// Firmware reports {x, y}; older builds used an [x, y] array.
const touchPoint = (event) => {
    if (!event) {
        return null;
    }
    if (event.x !== undefined && event.y !== undefined) {
        return {x: event.x, y: event.y};
    }
    if (event.length >= 2) {
        return {x: event[0], y: event[1]};
    }
    return null;
};

// Espruino lacks Array.prototype.find, so hit-test with a plain loop.
const boxAt = (point) => {
    const all = boxes();
    for (let i = 0; i < all.length; i++) {
        const box = all[i];
        if (point.x >= box.x1 && point.x <= box.x2 &&
            point.y >= box.y1 && point.y <= box.y2) {
            return box;
        }
    }
    return null;
};

Bangle.setUI({
    mode: "custom",
    back: () => {
        if (view === "countdown") showGrid();
        else Bangle.showClock();
    }
});

Bangle.on("touch", (button, event) => {
    if (view === "countdown") {
        showGrid();
        return;
    }

    const point = touchPoint(event);
    if (!point) {
        return;
    }

    const box = boxAt(point);
    if (box) {
        notify();
        startCountdown(box.timer);
    }
});

// Drawing measures the text offscreen, which takes long enough for a RAM
// upload still in flight to overflow the serial buffer and have Espruino
// interrupt the draw. Yielding first lets the upload finish.
setTimeout(drawGrid, 0);
