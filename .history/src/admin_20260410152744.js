import { db, storage } from "./firebase.js"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore"

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage"
const nameInput = document.getElementById("name")
const typeInput = document.getElementById("type")
const seriesInput = document.getElementById("series")
const imageInput = document.getElementById("image")
const modelInput = document.getElementById("model")
const form = document.getElementById("uploadForm")
const progressBar = document.getElementById("progressBar")
const listContainer = document.getElementById("vehicleList")

// admin.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Handle Upload Form Submission (adminupload.html) ---
    const uploadForm = document.querySelector('form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevents the page from refreshing
            
            // Get the value from the model name input
            const modelNameInput = document.querySelector('input[placeholder="Enter the model name"]');
            const modelName = modelNameInput ? modelNameInput.value.trim() : '';
            
            if (!modelName) {
                alert("Please enter a model name before submitting.");
                return;
            }

            // Simulate the upload process
            alert(`✅ Successfully submitted 3D asset data for: ${modelName}`);
            uploadForm.reset(); // Clear the form after submission
        });
    }

    // --- 2. Handle "Open" and "Edit" Buttons (adminhome.html & adminedit.html) ---
    const actionButtons = document.querySelectorAll('.bg-blue-500'); // Targets the blue card buttons
    actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const actionType = e.target.innerText.trim(); // "Open" or "Edit"
            const card = e.target.closest('.bg-white.rounded-xl'); // Find the parent card
            const vehicleName = card.querySelector('h3').innerText; // Get the car name
            
            if (actionType === 'Open') {
                alert(`Opening 3D viewer for ${vehicleName}...`);
            } else if (actionType === 'Edit') {
                alert(`Loading metadata editor for ${vehicleName}...`);
            }
        });
    });

    // --- 3. Handle Filter Reset Button ---
    const resetButton = document.querySelector('button.bg-gray-600'); // Targets the gray "Reset" button
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            // Find the dropdowns next to the reset button and set them to their first option
            const selects = document.querySelectorAll('select.border-gray-300');
            selects.forEach(select => select.selectedIndex = 0);
        });
    }
});