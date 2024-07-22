'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const form = document.querySelector('.form');
const tools = document.querySelector('.tools');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector('.delete__all');
const sortBy = document.querySelector('#sort-by');
const showBy = document.querySelector('#show-by');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = new Map(); // Harita işaretlerini saklamak için eklenen özellik

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));
    sortBy.addEventListener('change', this._sortWorkouts.bind(this));
    showBy.addEventListener('change', this._showWorkouts.bind(this));
    
    this._showTools();

    
  }

  _showWorkouts() {
    const selectedType = showBy.value;
    const filteredWorkouts = selectedType === 'all'
    ? this.#workouts
    : this.#workouts.filter(workout => workout.type === selectedType);
    this.#markers.forEach(marker => marker.remove());
    document.querySelectorAll('.workout').forEach(workoutEl => workoutEl.remove());

    filteredWorkouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
      this._renderWorkout(workout);
    });
  
    this._showTools();
  }
  
  

  _sortWorkouts(event) {
    const sortByValue = sortBy.value.toLowerCase();

    // Sıralama işlemi
    this.#workouts.sort((a, b) => {
      if (sortByValue === 'all') {
        return 0;
      } else if (sortByValue === 'distance') {
        return b.distance - a.distance;
      } else if(sortByValue === 'distance-negative'){
        return a.distance - b.distance;
      } else if (sortByValue === 'duration') {
        return b.duration - a.duration;
      } else if(sortByValue === 'duration-negative'){
        return a.duration - b.duration;
      }else if (sortByValue === 'cadence') {
        return (b.type === 'running' ? b.cadence : 0) - (a.type === 'running' ? a.cadence : 0);
      } else if(sortByValue === 'cadence-negative'){
        return (a.type === 'running' ? a.cadence : 0) - (b.type === 'running' ? b.cadence : 0);
      } else if (sortByValue === 'elevation') {
        return (b.type === 'cycling' ? b.elevationGain : 0) - (a.type === 'cycling' ? a.elevationGain : 0);
      }else if(sortByValue === 'elevation-negative'){
        return (a.type === 'cycling' ? a.elevationGain : 0) - (b.type === 'cycling' ? b.elevationGain : 0);
      } 
    });

    this.#markers.forEach(marker => marker.remove());
    document.querySelectorAll('.workout').forEach(workoutEl => workoutEl.remove());
    
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
      this._renderWorkout(work);
    });
  
    this._setLocalStorage();

  }

 
  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
    this._showTools();
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    this._showTools();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return alert('Inputs have to be positive numbers!');
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
    this._showTools();
  }

  _renderWorkoutMarker(workout) {
    if (!this.#map) return;

    // Eğer işaret zaten varsa, öncekini kaldır
    if (this.#markers.has(workout.id)) {
      this.#map.removeLayer(this.#markers.get(workout.id));
    }

    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // İşareti sakla
    this.#markers.set(workout.id, marker);
  }

  _renderWorkout(workout) {
    const html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <button class="workout__btn workout__btn--edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="workout__btn workout__btn--delete"><i class="fa-solid fa-trash"></i></button>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        ${workout.type === 'running' ? `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        ` : workout.type === 'cycling' ? `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        ` : ''}
      </li>
    `;

    form.insertAdjacentHTML('afterend', html);

    document.querySelectorAll('.workout__btn--edit').forEach(btn =>
      btn.addEventListener('click', this._editWorkout.bind(this))
    );
    document.querySelectorAll('.workout__btn--delete').forEach(btn =>
      btn.addEventListener('click', this._deleteWorkout.bind(this))
    );

    this._showTools();
  }

  _deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workoutId = workoutEl.dataset.id;
    this.#workouts = this.#workouts.filter(workout => workout.id !== workoutId);
    
    // Harita üzerindeki işareti kaldır
    if (this.#markers.has(workoutId)) {
      this.#map.removeLayer(this.#markers.get(workoutId));
      this.#markers.delete(workoutId);
    }

    workoutEl.remove();
    this._setLocalStorage();
    this._showTools();
  }

  _deleteAllWorkouts() {
    if (!confirm('Are you sure you want to delete all workouts?')) return;
    this.#markers.forEach(marker => marker.remove());
    document.querySelectorAll('.workout').forEach(workoutEl => workoutEl.remove());
    
    // Clear workouts array
    this.#workouts = [];
  
    // Hide tools
    this._showTools();
  
    // Update local storage
    this._setLocalStorage();
 
  }
  _editWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workoutId = workoutEl.dataset.id;
    const workout = this.#workouts.find(work => work.id === workoutId);
    if (!workout) return;

    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    if (workout.type === 'running') {
      inputCadence.value = workout.cadence;
      inputElevation.value = '';
    } else if (workout.type === 'cycling') {
      inputElevation.value = workout.elevationGain;
      inputCadence.value = '';
    }

    this._showForm({ latlng: { lat: workout.coords[0], lng: workout.coords[1] } });

    // Silme işlemini çağır
    this._deleteWorkout({ target: workoutEl.querySelector('.workout__btn--delete') });
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
    if (!workout) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _showTools() {
    if(this.#workouts.length > 0){
        tools.classList.remove('tools--hidden');
    } else {
        tools.classList.add('tools--hidden');
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      if (work.type === 'running') {
        Object.setPrototypeOf(work, Running.prototype);
      } else if (work.type === 'cycling') {
        Object.setPrototypeOf(work, Cycling.prototype);
      }
      this._renderWorkout(work);
      this._renderWorkoutMarker(work);
    });
  }
}

const app = new App();
