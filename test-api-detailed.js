// Test the API endpoint with detailed response analysis
const http = require('http');

async function testAPI() {
    console.log('🧪 Testing LinkedIn extraction via API (Bypass Cache)...');
    
    // Use a slightly different URL to bypass cache
    const postData = JSON.stringify({
        url: 'https://www.linkedin.com/company/versa-networks/?test=bypass-cache'
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
                        console.log('📄 Full Response Structure:');
                        console.log(JSON.stringify(result, null, 2));
                        
                        // Check Company field specifically  
                        if (result.Company) {
                            console.log('\n🏢 Company Data Found:');
                            console.log('📊 Company keys:', Object.keys(result.Company));
                            console.log('📛 Name:', result.Company.Name || '❌ Missing');
                            console.log('📝 Description:', result.Company.Description ? '✅ Found (' + result.Company.Description.length + ' chars)' : '❌ Missing');
                            console.log('🏭 Industry:', result.Company.Industry || '❌ Missing');
                            console.log('📅 Founded:', result.Company.Founded || '❌ Missing');
                            console.log('🏢 Headquarters:', result.Company.Headquarters || '❌ Missing');
                            console.log('👥 Employees:', result.Company.Employees || '❌ Missing');
                            console.log('🎯 Specialties:', result.Company.Specialties ? '✅ Found (' + result.Company.Specialties.length + ' items)' : '❌ Missing');
                        } else {
                            console.log('\n❌ No Company field found in response');
                        }
                        
                        // Check if cached
                        if (result._cached) {
                            console.log('\n⚠️ WARNING: Response was cached, may not reflect latest fixes');
                        } else {
                            console.log('\n✅ Fresh response (not cached)');
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