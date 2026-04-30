const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serves your HTML files

// Tell Multer where to save the uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'image') cb(null, './images/vehicles/');
        else if (file.fieldname === 'model') cb(null, './models/');
        else if (file.fieldname === 'manual') cb(null, './manuals/');
    },
    filename: function (req, file, cb) {
        // Keeps the original file extension (e.g., bmw_m5.glb)
        const uniqueName = req.body.vehicleId + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

// API Route to handle the Admin Upload
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

    // Save the text details to a local JSON database
    const dbPath = path.join(__dirname, 'database.json');
    let db = [];
    if (fs.existsSync(dbPath)) {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    
    db.push(newVehicle);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    res.json({ success: true, message: "Vehicle added successfully!" });
});

app.listen(3000, () => console.log('Local Server running on http://localhost:3000'));