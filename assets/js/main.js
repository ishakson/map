'use strict';
let userLang = navigator.language || navigator.userLanguage;
document.getElementById("html").setAttribute("lang",userLang);