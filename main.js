var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

function loadImage() {
  var reader = new FileReader();
  reader.onload = function(e) {
    var image = new Image();
    image.onload = function() {
      // Scale the image to fit the container.
      var [w, h] = getFitDimensions(image.width, image.height);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, w, h);
      paintImage(processImage());
    }
    image.src = e.target.result;
  }
  reader.readAsDataURL(document.getElementById('inputImage').files[0]);
  $('#toolbar').show();
}

function getFitDimensions(w, h) {
  var containerWidth = document.getElementsByClassName('container')[0].offsetWidth;
  if (w < containerWidth) {
    return [w, h];
  }
  return [containerWidth, h * containerWidth / w];
}

function processImage() {
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = pixelate(imageData, getPixelSize());
  return imageData;
}

function paintImage(image) {
  ctx.putImageData(image, 0, 0);
}

//
// Inputs
//

$('#toolbarForm').submit(function() {
  loadImage();
  return false;
});

function getPixelSize() {
  var pixelSize = getPixelSizeValue();
  document.getElementById('pixelSize').value = pixelSize;
  return pixelSize;
}

function getPixelSizeValue() {
  var pixelSize = parseInt(document.getElementById('pixelSize').value);
  if (!pixelSize || pixelSize < 1) {
    return 1;
  }
  if (pixelSize > canvas.width || pixelSize > canvas.height) {
    return Math.round(Math.min(canvas.width, canvas.height) / 2.1);
  }
  return Math.round(pixelSize);
}

//
// ImageData helpers
//

function get1dCoords(imageData, x, y) {
  var redIndex = y * (imageData.width * 4) + x * 4;
  return [redIndex, redIndex + 1, redIndex + 2, redIndex + 3];
}

function getPixel(imageData, x, y) {
  var coords = get1dCoords(imageData, x, y);
  return [imageData.data[coords[0]], imageData.data[coords[1]], imageData.data[coords[2]], imageData.data[coords[3]]];
}

function copyPixel(imageData, coords, input) {
  imageData.data[coords[0]] = input[0];
  imageData.data[coords[1]] = input[1];
  imageData.data[coords[2]] = input[2];
  imageData.data[coords[3]] = input[3];
}

//
// Image processors
//

function pixelate(imageData, pixelSize) {
  var processedImageData = ctx.createImageData(canvas.width, canvas.height);
  for (var x = 0; x < canvas.width; x += pixelSize) {
    for (var y = 0; y < canvas.height; y += pixelSize) {
      // Calculate avg pixel color
      var avg = getAverageColor(imageData, x, y, pixelSize, pixelSize);
      for (var nx = x; nx < x + pixelSize; nx++) {
        for (var ny = y; ny < y + pixelSize; ny++) {
          copyPixel(processedImageData, get1dCoords(imageData, nx, ny), avg);
        }
      }
    }
  }
  return processedImageData;
}

function getAverageColor(imageData, x, y, w, h) {
  var r = []; var g = []; var b = []; var a = [];
  for (var nx = x; nx < x + w; nx++) {
    for (var ny = y; ny < y + h; ny++) {
      var pixel = getPixel(imageData, nx, ny);
      r.push(pixel[0]);
      g.push(pixel[1]);
      b.push(pixel[2]);
      a.push(pixel[3]);
    }
  }
  return [getAverage(r), getAverage(g), getAverage(b), getAverage(a)]
}

function getAverage(array) {
  var sum = 0;
  for (var i = 0; i < array.length; i++) {
    sum += array[i];
  }
  return sum / array.length;
}