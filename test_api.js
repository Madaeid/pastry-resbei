
async function testApi() {
    try {
        const res = await fetch('http://localhost:3001/api/recipes/public');
        const data = await res.json();
        console.log('Is array:', Array.isArray(data));
        console.log('Sample:', JSON.stringify(data).substring(0, 100));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

testApi();
