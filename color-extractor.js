const { Vibrant } = require('node-vibrant/node');
const axios = require('axios');

class ColorExtractor {
    /**
     * Extracts the dominant color from an image URL.
     * @param {string} imageUrl The URL of the image.
     * @returns {Promise<string|null>} A promise that resolves to the dominant color in hex format, or null if an error occurs.
     */
    async extractColor(imageUrl) {
        if (!imageUrl) {
            console.warn('ColorExtractor: Image URL is missing.');
            return null;
        }

        try {
            // For data URIs, we need to decode them first
            if (imageUrl.startsWith('data:')) {
                const base64Data = imageUrl.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const palette = await Vibrant.from(buffer).getPalette();
                console.log('Palette:', palette);
                return palette.Vibrant ? palette.Vibrant.hex : null;
            }

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });

            console.log('Type of response.data:', typeof response.data);
            const palette = await Vibrant.from(response.data).getPalette();
            console.log('Palette:', palette);
            return palette.Vibrant ? palette.Vibrant.hex : null;
        } catch (error) {
            console.error(`ColorExtractor: Error processing image at ${imageUrl}`, error);
            return null;
        }
    }
}

module.exports = { ColorExtractor };
