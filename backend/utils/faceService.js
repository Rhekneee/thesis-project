const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

// Simple Face API wrapper. Expects environment variables:
// FACE_API_ENDPOINT (e.g., https://your-face-api/encode)
// FACE_API_KEY (optional header for auth)

module.exports = {
    extractEncodingFromImage: async (image) => {
        const endpoint = process.env.FACE_API_ENDPOINT;
        const apiKey = process.env.FACE_API_KEY;
        
        // If endpoint is not configured, fall back to a deterministic pseudo-encoding
        if (!endpoint) {
            const bytes = Buffer.isBuffer(image) ? image : fs.readFileSync(image);
            // Derive a 128-length embedding from sha256 hashes
            const chunks = [];
            let seed = bytes;
            while (chunks.length < 128) {
                const h = crypto.createHash('sha256').update(seed).digest();
                for (let i = 0; i < h.length && chunks.length < 128; i += 4) {
                    // map 4 bytes to a float in [-1, 1]
                    const slice = h.subarray(i, i + 4);
                    const val = slice.readUInt32BE(0) / 0xffffffff; // 0..1
                    chunks.push((val * 2) - 1);
                }
                seed = h;
            }
            return chunks;
        }

        // image can be a Buffer or a file path string
        const data = Buffer.isBuffer(image) ? image : fs.createReadStream(image);
        try {
            const response = await axios.post(endpoint, data, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    ...(apiKey ? { 'x-api-key': apiKey } : {})
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            // Expect the API to return { encoding: [...] } or similar structure
            const resp = response.data;
            return resp.encoding || resp.faceEncoding || resp;
        } catch (error) {
            console.error('❌ Face API error:', error.response?.status, error.response?.data || error.message);
            throw new Error('Face API request failed');
        }
    }
};


