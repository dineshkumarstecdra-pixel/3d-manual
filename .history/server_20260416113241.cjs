const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serves files from the root (e.g., /images/vehicles/...)
app.use(express.static(__dirname)); 
// Serves files from the public folder (e.g., /models/... and /manuals/...)
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 Create the exact folders matching your setup
const dirs = ['./images/vehicles', './public/models', './public/manuals'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Match your exact paths here:
        if (file.fieldname === 'image') cb(null, './images/vehicles/');
        else if (file.fieldname === 'model') cb(null, './public/models/');
        else if (file.fieldname === 'manual') cb(null, './public/manuals/');
    },
    filename: function (req, file, cb) {
        const uniqueName = req.body.vehicleId + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

app.post('/api/add-vehicle', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'model', maxCount: 1 },
    { name: 'manual', maxCount: 1 }
]), (req, res) => {
    
    const newVehicle = {
        id: req.body.vehicleId,
        name: req.body.vehicleName,
        region: req.body.region,
        type: req.body.type,
        series: req.body.series
    };

    const dbPath = path.join(__dirname, 'database.json');
    let db = [];
    
    if (fs.existsSync(dbPath)) {
        const fileData = fs.readFileSync(dbPath, 'utf8');
        if (fileData.trim() !== "") {
            try {
                db = JSON.parse(fileData);
            } catch (err) {
                console.error("Error reading database.json. Resetting to empty array.");
                db = [];
            }
        }
    }
    
    db.push(newVehicle);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    res.json({ success: true, message: "Vehicle added successfully!" });
});

app.listen(3000, () => console.log('Local Server running on http://localhost:3000'));