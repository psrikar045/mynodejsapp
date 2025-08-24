const { ColorExtractor } = require('./color-extractor');
const assert = require('assert');

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function colorDistance(rgb1, rgb2) {
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}

async function testColorExtractor() {
    console.log('🚀 Testing ColorExtractor...');
    const colorExtractor = new ColorExtractor();

    // Test with a data URI of a blue square
    const blueSquareDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';
    const color = await colorExtractor.extractColor(blueSquareDataUri);

    console.log('Extracted color:', color);
    const expectedColor = '#0000ff';
    const distance = colorDistance(hexToRgb(color), hexToRgb(expectedColor));
    assert.ok(distance < 10, `The extracted color should be close to blue. Distance: ${distance}`);

    console.log('✅ ColorExtractor test passed!');
}

testColorExtractor();
