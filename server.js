const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

const DATA_FILE = './data.json';

// Helper functions for reading and writing JSON data
const readData = () => {
  const data = fs.readFileSync(DATA_FILE);
  return JSON.parse(data);
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Route to get the list of all vehicles
app.get('/vehicles', (req, res) => {
  const data = readData();
  res.json(data.vehicles);
});

// Route to get the top 3 rated vehicles
app.get('/top-rated-vehicles', (req, res) => {
  const data = readData();
  const topRated = data.vehicles
    .filter(v => v.rating)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  res.json(topRated);
});

// Nova ruta za dobijanje rezervisanih vozila sa informacijama o rentijeru
app.get('/reserved-vehicles', (req, res) => {
  const data = readData();
  const reservedVehicles = data.reservations.map(reservation => {
    const vehicle = data.vehicles.find(v => v.id === reservation.vehicleId);
    const renter = data.renters.find(r => r.id === reservation.renterId);
    return {
      id: vehicle.id,
      model: vehicle.model,
      plannedReturnDate: reservation.returnDate, // Prilagodite ovde
      renterName: renter.name // Prilagodite ovde
    };
  });
  res.json(reservedVehicles);
});


// New route for getting renters
app.get('/renters', (req, res) => {
  const data = readData();
  res.json(data.renters);
});

// Route for handling vehicle reservations (including renter creation)
app.post('/reserve-vehicle', (req, res) => {
  const data = readData();
  const { vehicleId, renterName, returnDate } = req.body;

  const vehicle = data.vehicles.find(v => v.id === parseInt(vehicleId));
  const renterId = data.renters.length + 1;

  if (vehicle && !vehicle.reserved) {
    // Update vehicle status
    vehicle.reserved = true;

    // Add new renter
    data.renters.push({ id: renterId, name: renterName });

    // Add reservation
    data.reservations.push({
      vehicleId: vehicle.id,
      renterId: renterId,
      returnDate: returnDate
    });

    // Save updated data
    writeData(data);

    res.status(200).send('Reservation successful');
  } else {
    res.status(400).send('Vehicle is already reserved or not found');
  }
});

// Combined route for handling vehicle return, rating, and removing reservation
app.post('/return-vehicle', (req, res) => {
  const { vehicleId, rating } = req.body;
  const data = readData();

  const vehicle = data.vehicles.find(v => v.id === parseInt(vehicleId));
  if (vehicle && vehicle.reserved) {
    // Update vehicle to available
    vehicle.reserved = false;
    vehicle.rating = rating;

    // Remove reservation
    const reservationIndex = data.reservations.findIndex(r => r.vehicleId === vehicle.id);
    if (reservationIndex !== -1) {
      data.reservations.splice(reservationIndex, 1);
    }

    // Save updated data
    writeData(data);

    // Emit update to all clients
    io.emit('reservationUpdate', data.reservations);

    res.status(200).send('Vehicle returned and rated successfully');
  } else {
    res.status(400).send('Vehicle not found or not reserved');
  }
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});






