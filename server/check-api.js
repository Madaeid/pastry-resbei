async function check() {
    try {
        const res = await fetch('http://localhost:3001/api/recipes/public');
        if (!res.ok) {
            console.log('Status Error:', res.status);
            const errBody = await res.text();
            console.log('Error Body:', errBody);
            return;
        }
        const data = await res.json();
        console.log('Public recipes count:', data.length);
        if (data.length > 0) {
            console.log('First recipe sample:', {
                id: data[0].id,
                name: data[0].name,
                author: data[0].author
            });
        }
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

check();
