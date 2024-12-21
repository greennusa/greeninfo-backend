const express = require('express');
const si = require('systeminformation');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = 3333;

// Cache configuration
let cache = {};
const cacheTimeout = 60 * 1000; // 1 minute in milliseconds

// CPU usage history
let cpuUsageHistory = [];
const maxHistoryLength = 10; // Number of history entries to store

// Utility function to update cache
const getCachedData = async (key, fetchFunction) => {
    const currentTime = Date.now();
    if (cache[key] && currentTime - cache[key].timestamp < cacheTimeout) {
        return cache[key].data;
    }
    const data = await fetchFunction();
    cache[key] = { timestamp: currentTime, data };
    return data;
};

// Fetch system specs
const fetchSpecs = async () => {
    const cpu = await si.cpu();
    const memory = await si.mem();
    const osInfo = await si.osInfo();
    const disk = await si.diskLayout();
    const gpu = await si.graphics();

    return {
        cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            cores: cpu.cores,
            speed: cpu.speed + ' GHz',
        },
        memory: {
            total: (memory.total / (1024 ** 3)).toFixed(2) + ' GB',
        },
        os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            kernel: osInfo.kernel,
        },
        disks: disk.map(d => ({
            name: d.name,
            size: (d.size / (1024 ** 3)).toFixed(2) + ' GB',
            type: d.type,
        })),
        gpu: gpu.controllers.map(g => ({
            model: g.model,
            vram: g.vram + ' MB',
            memoryUsed: g.memoryUsed ? g.memoryUsed + ' MB' : 'N/A',
            memoryFree: g.memoryFree ? g.memoryFree + ' MB' : 'N/A',
        })),
    };
};

// Fetch system usage
const fetchUsage = async () => {
    const currentLoad = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();

    // Update CPU usage history
    cpuUsageHistory.push(currentLoad.currentLoad.toFixed(2));
    if (cpuUsageHistory.length > maxHistoryLength) {
        cpuUsageHistory.shift();
    }

    return {
        cpu: {
            load: currentLoad.currentLoad.toFixed(2) + ' %',
            history: [...cpuUsageHistory], // Return CPU usage history
        },
        memory: {
            total: (memory.total / (1024 ** 3)).toFixed(2) + ' GB',
            used: ((memory.total-memory.free) / (1024 ** 3)).toFixed(2) + ' GB',
            usage: (((memory.total-memory.free) / memory.total) * 100).toFixed(2) + ' %',
        },
        storage: disk.map(d => ({
            filesystem: d.fs,
            size: (d.size / (1024 ** 3)).toFixed(2) + ' GB',
            used: (d.used / (1024 ** 3)).toFixed(2) + ' GB',
            usage: d.use + ' %',
        })),
    };
};

// Route: Server Specs
app.get('/specs', async (req, res) => {
    try {
        const specs = await getCachedData('specs', fetchSpecs);
        res.json(specs);
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch system specs' });
    }
});

// Route: Real-time Resource Usage
app.get('/usage', async (req, res) => {
    try {
        const usage = await getCachedData('usage', fetchUsage);
        res.json(usage);
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch system usage' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
