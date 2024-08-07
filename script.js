'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration, from, to) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.from = from;
    this.to = to;
    
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, from, to, cadence) {
    super(coords, distance, duration, from, to);
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

  constructor(coords, distance, duration, from, to, elevationGain) {
    super(coords, distance, duration, from, to);
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
const overviewBtn = document.querySelector('.overview');
const overlay = document.querySelector('.overlay');
const warning = document.querySelector('.warning');
const fromInput = document.querySelector('.form__input--from');
const toInput = document.querySelector('.form__input--to');
const weatherDiv = document.querySelector('.weather');

class App {
  
  
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = new Map();
  #userMarker;
  #blinkInterval;
  #routingControl;
  #userCoords;
  

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));
    sortBy.addEventListener('change', this._sortWorkouts.bind(this));
    showBy.addEventListener('change', this._showWorkouts.bind(this));
    overviewBtn.addEventListener('click', this._showOverview.bind(this));
    this.#routingControl = null;
    

    this._showTools();
  }

  _showOverview() {
    if (!this.#map || this.#workouts.length === 0) return;

    const group = new L.featureGroup(Array.from(this.#markers.values()));
    this.#map.fitBounds(group.getBounds(), {
      padding: [50, 50], // Padding ekleyin: [top-bottom, left-right] değerleri
      maxZoom: this.#mapZoomLevel - 1, // Maksimum zoom seviyesini ayarlayın (isteğe bağlı)
    });
  }
  _showWorkouts() {
    const selectedType = showBy.value;
    const filteredWorkouts =
      selectedType === 'all'
        ? this.#workouts
        : this.#workouts.filter(workout => workout.type === selectedType);
    this.#markers.forEach(marker => marker.remove());
    document
      .querySelectorAll('.workout')
      .forEach(workoutEl => workoutEl.remove());

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
      } else if (sortByValue === 'distance-negative') {
        return a.distance - b.distance;
      } else if (sortByValue === 'duration') {
        return b.duration - a.duration;
      } else if (sortByValue === 'duration-negative') {
        return a.duration - b.duration;
      } else if (sortByValue === 'cadence') {
        return (
          (b.type === 'running' ? b.cadence : 0) -
          (a.type === 'running' ? a.cadence : 0)
        );
      } else if (sortByValue === 'cadence-negative') {
        return (
          (a.type === 'running' ? a.cadence : 0) -
          (b.type === 'running' ? b.cadence : 0)
        );
      } else if (sortByValue === 'elevation') {
        return (
          (b.type === 'cycling' ? b.elevationGain : 0) -
          (a.type === 'cycling' ? a.elevationGain : 0)
        );
      } else if (sortByValue === 'elevation-negative') {
        return (
          (a.type === 'cycling' ? a.elevationGain : 0) -
          (b.type === 'cycling' ? b.elevationGain : 0)
        );
      }
    });

    this.#markers.forEach(marker => marker.remove());
    document
      .querySelectorAll('.workout')
      .forEach(workoutEl => workoutEl.remove());

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
      this._renderWorkout(work);
    });

    this._setLocalStorage();
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this)
        ,
        function () {
          overlay.style.display = 'block';
          warning.style.display = 'block';
          let html = `
            <h2>Could not get your position</h2>
            <p>Please allow us to use your position</p>
            `;
          warning.innerHTML = html;
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#userCoords = coords;
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    this.#map.on('click', this._showForm.bind(this));
    this.#map.on('click', this._showRoute.bind(this));
   

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
    this._showUserLocation(coords);
    this._showTools();
  }

   _showRoute(e) {
    if (!this.#map) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const currentLatLng = L.latLng(latitude, longitude);
          const destinationLatLng = L.latLng(e.latlng.lat, e.latlng.lng);

          if (this.#routingControl) {
            this.#map.removeControl(this.#routingControl);
          }

          this.#routingControl = L.Routing.control({
            waypoints: [currentLatLng, destinationLatLng],
            routeWhileDragging: true,
          }).addTo(this.#map);
          this._updateForm(currentLatLng, destinationLatLng);
          this._getWeather(destinationLatLng.lat, destinationLatLng.lng);
         
        },
        error => {
          overlay.style.display = 'block';
          warning.style.display = 'block';
          let html = `
            <h2>Could not get your position</h2>
            <p>Please allow us to use your position</p>
            `;
          warning.innerHTML = html;
          setTimeout(() => {
            overlay.style.display = 'none';
            warning.style.display = 'none';
          }, 1000);
        }
      );
    } else {
      overlay.style.display = 'block';
      warning.style.display = 'block';
      let html = `
        <h2>Could not get your position</h2>
        <p>Please allow us to use your position</p>
        `;
      warning.innerHTML = html;
      setTimeout(() => {
        overlay.style.display = 'none';
        warning.style.display = 'none';
      }, 1000);
    }
  }
  async _getWeather(lat, lon) {
    const apiKey = '14dd046fc081b8f462c1654591d21592';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  
    try {
      
      const response = await fetch(url);
  
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      
      const data = await response.json();
  
      weatherDiv.innerHTML = `
        
        <p>Temperature: ${data.main.temp}°C</p>
        
      `;
  
      
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error; 
    }
  }

  async _updateForm(currentLatLng, destinationLatLng) {
    // Calculate distance between user location and clicked point
    const distanceInMeters = currentLatLng.distanceTo(destinationLatLng);
    const distanceInKm = distanceInMeters / 1000;
    fromInput.value = await this._getAddress(currentLatLng);

    toInput.value = await this._getAddress(destinationLatLng);
    inputDistance.value = distanceInKm.toFixed(2);

    const estimatedSpeed = 5;
    const estimatedDurationInHours = distanceInKm / estimatedSpeed;
    const estimatedDurationInMinutes = estimatedDurationInHours * 60;

    form.querySelector('.form__input--duration').value =
      estimatedDurationInMinutes.toFixed(0);

    if (inputType.value === 'running') {
      inputCadence.value = 180;
      inputElevation.value = '';
    } else if (inputType.value === 'cycling') {
      inputElevation.value = 100;
      inputCadence.value = '';
    }
  }

  async _getAddress(coords) {
    const { lat, lng } = coords;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return data.display_name;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }
  _showUserLocation(coords) {
    if (this.#userMarker) {
      this.#map.removeLayer(this.#userMarker);
      clearInterval(this.#blinkInterval);
    }

    this.#userMarker = L.marker(coords, {
      icon: L.divIcon({
        className: 'user-location-icon',
        html: '<div class="user-location"></div>',
        iconSize: [20, 20],
      }),
    }).addTo(this.#map);

    // Yanıp sönme efekti
    let visible = true;
    this.#blinkInterval = setInterval(() => {
      visible = !visible;
      this.#userMarker.getElement().style.opacity = visible ? '1' : '0';
    }, 1000);
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    if (inputType.value === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');

      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    } else if (inputType.value === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');

      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
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
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const from = fromInput.value.split(', ')[0];

    const to = toInput.value.split(', ')[0];


    
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        overlay.style.display = 'block';
        warning.style.display = 'block';
        let html = `
          <h2>Inputs have to be positive numbers!</h2>
          <p>Please check your inputs</p>

          `;
        warning.innerHTML = html;
        setTimeout(() => {
          overlay.style.display = 'none';
          warning.style.display = 'none';
        }, 1000);
        return;
      } else {
        workout = new Running(
          [lat, lng],
          distance,
          duration,
          from,
          to,
          cadence
        );
      }
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        overlay.style.display = 'block';
        warning.style.display = 'block';
        let html = `
          <h2>Inputs have to be positive numbers!</h2>
          <p>Please check your inputs</p>`;

        warning.innerHTML = html;
        setTimeout(() => {
          overlay.style.display = 'none';
          warning.style.display = 'none';
        }, 1000);
        return;
      } else {
        workout = new Cycling(
          [lat, lng],
          distance,
          duration,
          from,
          to,
          elevation
        );
      }
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

    marker.on('click', this._showRoute.bind(this));
    // İşareti sakla
    this.#markers.set(workout.id, L.marker(workout.coords));
  }

  _renderWorkout(workout) {
    const html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <button class="workout__btn workout__btn--edit"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="workout__btn workout__btn--delete"><i class="fa-solid fa-trash"></i></button>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        
        ${
          workout.type === 'running'
            ? `
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
          <div class="workout__details">
          <span class="workout__from">${workout.from}</span>
          <span class="workout__to">${workout.to}</span>
        </div>
        `
            : workout.type === 'cycling'
            ? `
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
          <div class="workout__details">
            <span class="workout__from">${workout.from}</span>
            <span class="workout__to">${workout.to}</span>
           
            
          </div>
        `
            : ''
        }
      </li>
    `;
    form.insertAdjacentHTML('afterend', html);

    document
      .querySelectorAll('.workout__btn--edit')
      .forEach(btn =>
        btn.addEventListener('click', this._editWorkout.bind(this))
      );
    document
      .querySelectorAll('.workout__btn--delete')
      .forEach(btn =>
        btn.addEventListener('click', this._deleteWorkout.bind(this))
      );

    this._showTools();
  }

  _deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workoutId = workoutEl.dataset.id;
    this.#workouts = this.#workouts.filter(workout => workout.id !== workoutId);

    this.#map.removeLayer(this.#markers.get(workoutId));

    this.#markers.delete(workoutId);

    workoutEl.remove();
    this._setLocalStorage();
    this._showTools();
  }

  _deleteAllWorkouts() {
    overlay.style.display = 'block';
    warning.style.display = 'block';
    let html = `<p>Are you sure you want to delete all workouts?</p>
    <button class="confirm__btn">Yes</button>
    <button class="cancel__btn">No</button>`;
    warning.innerHTML = html;
    let confirmBtn = document.querySelector('.confirm__btn');
    let cancelBtn = document.querySelector('.cancel__btn');
    confirmBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      warning.style.display = 'none';
      this.#workouts = [];

      this.#markers.forEach(marker => marker.remove());
      this.#markers.clear();

      document
        .querySelectorAll('.workout')
        .forEach(workoutEl => workoutEl.remove());
      this._setLocalStorage();
      this._showTools();
    });
    cancelBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      warning.style.display = 'none';
    });
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

    this._showForm({
      latlng: { lat: workout.coords[0], lng: workout.coords[1] },
    });

    // Silme işlemini çağır
    this._deleteWorkout({
      target: workoutEl.querySelector('.workout__btn--delete'),
    });
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    if (!workout) return;

    if (this.#routingControl) {
      this.#map.removeControl(this.#routingControl);
    }

    // Yeni yönlendirme kontrolü oluştur
    const workoutLatLng = L.latLng(workout.coords[0], workout.coords[1]);
    this.#routingControl = L.Routing.control({
      waypoints: [
        L.latLng(this.#userCoords[0], this.#userCoords[1]), // Kullanıcı konumu
        workoutLatLng, // Workout konumu
      ],
      routeWhileDragging: true,
    }).addTo(this.#map);

    this.#map.setView(workoutLatLng, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _showTools() {
    if (this.#workouts.length > 0) {
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
