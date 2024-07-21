export class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);
    clicks = 0;
  
    constructor(coords, distance, duration) {
      this.coords = coords; // [lat, lng]
      this.distance = distance; // in km
      this.duration = duration; // in min
    }
  
    _setDescription() {
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }
  
    click() {
      this.clicks++;
    }
  }