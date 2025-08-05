// Test the API endpoint directly
const http = require('http');

async function testAPI() {
    console.log('🧪 Testing LinkedIn extraction via API...');
    
    const postData = JSON.stringify({
        url: 'https://www.linkedin.com/company/versa-networks/'
    });
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/extract-company-details',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ API Response received');
                    console.log('📊 Status Code:', res.statusCode);
                    
                    if (res.statusCode === 200) {
                        // Check LinkedIn data specifically
                        if (result.Name && result.Name !== 'Join' && result.Name !== '') {
                            console.log('🎉 SUCCESS: LinkedIn data extracted via API!');
                            console.log('📛 Company Name:', result.Name);
                            console.log('📝 Description:', result.Description ? result.Description.substring(0, 100) + '...' : '❌ Not found');
                            console.log('🏭 Industry:', result.Industry || '❌ Not found');
                            console.log('📅 Founded:', result.Founded || '❌ Not found');
                            console.log('🏢 Headquarters:', result.Headquarters || '❌ Not found');
                        } else {
                            console.log('⚠️ WARNING: Basic extraction worked but LinkedIn data missing');
                            console.log('📊 Full result keys:', Object.keys(result));
                        }
                    } else {
                        console.log('❌ API Error:', result);
                    }
                    
                    resolve(result);
                } catch (e) {
                    console.log('💥 JSON Parse Error:', e.message);
                    console.log('📄 Raw response:', data);
                    reject(e);
                }
            });
        });
        
        req.on('error', (e) => {
            console.log('🚨 Request Error:', e.message);
            reject(e);
        });
        
        req.write(postData);
        req.end();
    });
}

testAPI().catch(console.error);