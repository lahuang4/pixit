var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

function loadImageWithoutPalette() {
  loadImage([]);
}

function loadImage(palette) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var image = new Image();
    image.onload = function() {
      // Scale the image to fit the container.
      var [w, h] = getFitDimensions(image.width, image.height);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, w, h);
      paintImage(processImage(palette));
    }
    image.src = e.target.result;
  }
  reader.readAsDataURL(document.getElementById('input-image').files[0]);
  $('#toolbar').show();
}

function downloadImage() {
  var link = document.createElement('a');
  link.download = 'pixelized.png';
  link.href = canvas.toDataURL()
  link.click();
}

function getFitDimensions(w, h) {
  var containerWidth = document.getElementsByClassName('container')[0].offsetWidth;
  if (w < containerWidth) {
    return [w, h];
  }
  return [containerWidth, h * containerWidth / w];
}

function processImage(palette) {
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = pixelate(imageData, getPixelSize(), palette);
  return imageData;
}

function paintImage(image) {
  ctx.putImageData(image, 0, 0);
}

//
// Inputs
//

$('#toolbar-form').submit(function() {
  loadImage();
  return false;
});

function getPixelSize() {
  var pixelSize = getPixelSizeValue();
  document.getElementById('pixel-size').value = pixelSize;
  return pixelSize;
}

function getPixelSizeValue() {
  var pixelSize = parseInt(document.getElementById('pixel-size').value);
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

function pixelate(imageData, pixelSize, palette) {
  var processedImageData = ctx.createImageData(canvas.width, canvas.height);
  for (var x = 0; x < canvas.width; x += pixelSize) {
    for (var y = 0; y < canvas.height; y += pixelSize) {
      // Calculate avg pixel color
      var avg = getAverageColor(imageData, x, y, pixelSize, pixelSize);
      var color = getClosestColor(avg, palette);
      for (var nx = x; nx < x + pixelSize; nx++) {
        for (var ny = y; ny < y + pixelSize; ny++) {
          copyPixel(processedImageData, get1dCoords(imageData, nx, ny), color);
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

// Returns the color closest to the given starting color from the given palette.
// If palette is empty, returns the starting color.
function getClosestColor(color, palette) {
  if (!palette.length) {
    // The palette is empty. Return the starting color.
    return color;
  }
  // Calculate distances of the color to all members of the palette.
  var diffs = palette.map(function (paletteColor) {
    return deltaE(sRGBToCIELab(color), sRGBToCIELab(paletteColor));
  });
  var minI = 0;
  var minDiff = diffs[0];
  for (var i = 1; i < diffs.length; i++) {
    if (diffs[i] < minDiff) {
      minI = i;
      minDiff = diffs[i];
    }
  }
  return palette[minI];
}

//
// Palette helpers
//

COLORPICKER = '<label class="palette-color"><input type="color"></label>';

$(document).on('change', 'input[type=color]', function() {
  this.parentNode.style.backgroundColor = this.value;
});

function addColor() {
  $('#palette-colors').append(COLORPICKER);
}

function removeColor() {
  if ($('.palette-color').length <= 1) {
    // Only one color left, we don't want to remove that.
    return;
  }
  $('#palette-colors').children().last().remove();
}

function loadImageWithPalette() {
  var palette = [];
  $('input[type=color]').each(function () {
    palette.push(hexToRgba($(this).val()));
  });
  if (palette.length < 2) {
    alert('Please add at least 2 colors to your palette.');
    return;
  }
  loadImage(palette);
}

function hexToRgba(hex) {
  return [parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    255];
}

/**
 * Convert an sRGB color to CIELAB
 * http://www.easyrgb.com/en/math.php
 * 
 * @param {Array} sRGB sRGB color in array format
 */
function sRGBToCIELab(sRGB) {
  // Convert sRGB to CIELab using the math from 
  // First, convert sRGB to XYZ 
  var var_R = sRGB[0] / 255;
  var var_G = sRGB[1] / 255;
  var var_B = sRGB[2] / 255;

  function _XYZ_convert(value) {
    if (value > 0.04045) {
      return 100 * Math.pow((value + 0.055) / 1.055, 2.4);
    }
    return 100 * value / 12.92;
  }

  var_R = _XYZ_convert(var_R);
  var_G = _XYZ_convert(var_G);
  var_B = _XYZ_convert(var_B);

  var X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
  var Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
  var Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

  // Then, convert XYZ to CIELab
  const ref_X = 95.047;
  const ref_Y = 100.000;
  const ref_Z = 108.883;

  var var_X = X / ref_X;
  var var_Y = Y / ref_Y;
  var var_Z = Z / ref_Z;

  function _lab_convert(value) {
    if (value > 0.008856) {
      return Math.pow(value, 1 / 3);
    }
    return 7.787 * value + 16 / 116;
  }
  var_X = _lab_convert(var_X);
  var_Y = _lab_convert(var_Y);
  var_Z = _lab_convert(var_Z);

  var L = (116 * var_Y) - 16;
  var a = 500 * (var_X - var_Y);
  var b = 200 * (var_Y - var_Z);

  return [L, a, b];
}

/**
 * calculate the perceptual distance between colors in CIELAB
 * https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs
 * 
 * @param {Array} lab1 First LAB color in array
 * @param {Array} lab2 Second LAB color in array
 */
function deltaE(lab1, lab2) {
  var deltaL = lab1[0] - lab2[0];
  var deltaA = lab1[1] - lab2[1];
  var deltaB = lab1[2] - lab2[2];

  var c1 = Math.sqrt(lab1[1] * lab1[1] + lab1[2] * lab1[2]);
  var c2 = Math.sqrt(lab2[1] * lab2[1] + lab2[2] * lab2[2]);

  var deltaC = c1 - c2;
  var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);

  var sc = 1.0 + 0.045 * c1;
  var sh = 1.0 + 0.015 * c1;

  var deltaLKlsl = deltaL / (1.0);
  var deltaCkcsc = deltaC / (sc);
  var deltaHkhsh = deltaH / (sh);

  var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}
