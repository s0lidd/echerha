const fs = require('fs');

const cars = [
    'CE 2486 BA', 
    'AC 5020 HH',
    'BC 8438 PH',
    'BK 1234 BP'
];

const HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-client-locale': 'uk',
    'x-device-id': '6f17abb3-d96a-4aaf-b964-57b9b0dbdabb',
    'x-device-name': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'x-user-agent': 'UABorder/3.10.0 Web/1.1.0 User/guest'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processCar(plate) {
    try {
        const searchUrl = `https://back.echerha.gov.ua/api/v5/workload/search?plate_number=${encodeURIComponent(plate)}`;
        const searchRes = await fetch(searchUrl, { headers: HEADERS });
        
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return null;

        const carBase = searchData.data[0];

        if (carBase.queue_status === 50) return null;

        const detailsUrl = `https://back.echerha.gov.ua/api/v5/workload/1/checkpoints/${carBase.checkpoint_id}/details/${carBase.shared_type}/${carBase.queue_status}?page=1&plate_number=${encodeURIComponent(plate)}`;
        const detailsRes = await fetch(detailsUrl, { headers: HEADERS });
        
        if (!detailsRes.ok) return null;
        const detailsData = await detailsRes.json();
        const details = detailsData.data[0];
        
        if (details.time_on_inspection) return null;

        return {
            plate: plate,
            details: details,
            checkpoint: detailsData.checkpoint
        };
    } catch (error) {
        console.error(`Помилка для ${plate}:`, error.message);
        return null;
    }
}

async function run() {
    console.log('Початок сканування...');
    const startTime = Date.now();
    const results = [];

    for (let i = 0; i < cars.length; i++) {
        console.log(`Перевірка [${i+1}/${cars.length}]: ${cars[i]}`);
        const data = await processCar(cars[i]);
        if (data) results.push(data);
        
        if (i < cars.length - 1) await delay(2500);
    }

    const endTime = Date.now();
    const midTime = new Date((startTime + endTime) / 2);

    const finalData = {
        updatedAt: midTime.toISOString(),
        queues: results
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log(`Сканування завершено! Збережено машин: ${results.length}`);
}

run();
