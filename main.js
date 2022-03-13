var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

function loadImageWithoutPalette() {
  loadImage([]);
}

function loadImage(palette) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var image = new Image();
    image.onload = function () {
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

$('#toolbar-form').submit(function () {
  loadImage();
  return false;
});

// Only show one collapsed tool control at a time.
$('#toolbar').on('show.bs.collapse', '.collapse', function () {
  $('#toolbar').find('.collapse').collapse('hide');
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
      paintPixel(processedImageData, x, y, pixelSize, color);
    }
  }
  return processedImageData;
}

// Paints a "pixel" on imageData, starting at (x, y), of a given size and color.
// color should be an [r, g, b, a] array.
function paintPixel(imageData, x, y, size, color) {
  for (var nx = x; nx < x + size; nx++) {
    for (var ny = y; ny < y + size; ny++) {
      copyPixel(imageData, get1dCoords(imageData, nx, ny), color);
    }
  }
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
  return [getAverage(r), getAverage(g), getAverage(b), getAverage(a)];
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
    return deltaE00(sRGBToCIELab(color), sRGBToCIELab(paletteColor));
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
// Painting helpers
//

var paint;

// Add mouse handlers.
canvas.addEventListener('mousemove', mouseMove);
canvas.addEventListener('mousedown', mouseDown);
canvas.addEventListener('mouseup', mouseUp);

function mouseDown(e) {
  paint = true;
  var canvasRect = canvas.getBoundingClientRect();
  var x = e.pageX - canvasRect.left - window.scrollX;
  var y = e.pageY - canvasRect.top - window.scrollY;
  repaint(x, y);
}

function mouseUp(e) {
  paint = false;
}

function mouseMove(e) {
  if (!paint) {
    return;
  }
  var canvasRect = canvas.getBoundingClientRect();
  var x = e.pageX - canvasRect.left - window.scrollX;
  var y = e.pageY - canvasRect.top - window.scrollY;
  repaint(x, y);
}

// Given a point (x, y), repaints the "pixel" that it belongs to.
function repaint(x, y) {
  // Get repaint color.
  var color = [0, 0, 0, 255];
  $('#repaint-colors input[type=color]').each(function () {
    color = hexToRgba($(this).val());
  });

  // Locate the top-left corner of the current pixel, based on the pixel size.
  var pixelSize = getPixelSize();
  var startX = Math.floor(x / pixelSize) * pixelSize;
  var startY = Math.floor(y / pixelSize) * pixelSize;

  // Repaint all pixels corresponding to this pixel
  var processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  paintPixel(processedImageData, startX, startY, pixelSize, color);
  paintImage(processedImageData);
}

//
// Palette helpers
//

COLORPICKER = '<label class="palette-color"><input type="color"></label>';

$(document).on('change', 'input[type=color]', function () {
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
  $('#palette-colors input[type=color]').each(function () {
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

//
// Color distance helpers
//

/**
 * Convert an sRGB color to CIELab
 * CIELab is a color space used by the human eye, and is 
 * the basis of the perceptual color difference algorithm
 * defined by International Commission on Illumination 
 * (abbreviated CIE) in 1976.
 * 
 * Read more about the color difference algorithms:
 * https://en.wikipedia.org/wiki/Color_difference
 * 
 * Read more about the CIELab color space:
 * https://en.wikipedia.org/wiki/CIELab
 * 
 * Read more about the CIE 1931 color space (also known as XYZ):
 * https://en.wikipedia.org/wiki/CIE_1931_color_space
 * 
 * All formulas taken from:
 * http://www.easyrgb.com/en/math.php
 * 
 * @param {Array} sRGB sRGB color in array format
 */
function sRGBToCIELab(sRGB) {
  // First, convert sRGB to XYZ 
  var var_R = sRGB[0] / 255;
  var var_G = sRGB[1] / 255;
  var var_B = sRGB[2] / 255;

  function _XYZ_convert(value) {
    // This is an approximation of an integral, see more 
    // https://en.wikipedia.org/wiki/CIE_1931_color_space#Analytical_approximation
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
    // Explanations for the constants:
    // https://en.wikipedia.org/wiki/CIELAB_color_space#From_CIEXYZ_to_CIELAB
    // Mostly chosen to match in value and slope at specific places.
    if (value > 0.008856) {
      return Math.pow(value, 1 / 3);
    }
    return 7.787 * value + 16 / 116;
  }
  var_X = _lab_convert(var_X);
  var_Y = _lab_convert(var_Y);
  var_Z = _lab_convert(var_Z);

  // Explanation of CIELab values
  // L = lightness of the color (L* = 0 yields black and L* = 100 indicates diffuse white; specular white may be higher), 
  // a = its position between red and green (a*, where negative values indicate green and positive values indicate red)
  // b = its position between yellow and blue (b*, where negative values indicate blue and positive values indicate yellow).
  var L = (116 * var_Y) - 16;
  var a = 500 * (var_X - var_Y);
  var b = 200 * (var_Y - var_Z);

  return [L, a, b];
}

/**
 * The difference between two given colours with respect to the human eye
 * using the CIEDE2000 algorithm.
 * https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
 * For a more intuitive explanation and visualizations, see 
 * http://zschuessler.github.io/DeltaE/learn/
 * @param {Array} lab1 First LAB color in array
 * @param {Array} lab2 Second LAB color in array
*/
function deltaE00(lab1, lab2) {
  var l1 = lab1[0];
  var a1 = lab1[1];
  var b1 = lab1[2];
  var l2 = lab2[0];
  var a2 = lab2[1];
  var b2 = lab2[2];
  // Utility functions added to Math Object
  Math.rad2deg = function (rad) {
    return 360 * rad / (2 * Math.PI);
  };
  Math.deg2rad = function (deg) {
    return (2 * Math.PI * deg) / 360;
  };
  // Start Equation
  // Equation exist on the following URL 
  // http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE2000.html
  const avgL = (l1 + l2) / 2;
  const c1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
  const c2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
  const avgC = (c1 + c2) / 2;
  const g = (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7)))) / 2;

  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);

  const c1p = Math.sqrt(Math.pow(a1p, 2) + Math.pow(b1, 2));
  const c2p = Math.sqrt(Math.pow(a2p, 2) + Math.pow(b2, 2));

  const avgCp = (c1p + c2p) / 2;

  let h1p = Math.rad2deg(Math.atan2(b1, a1p));
  if (h1p < 0) {
    h1p = h1p + 360;
  }

  let h2p = Math.rad2deg(Math.atan2(b2, a2p));
  if (h2p < 0) {
    h2p = h2p + 360;
  }

  const avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;

  const t = 1 - 0.17 * Math.cos(Math.deg2rad(avghp - 30)) + 0.24 * Math.cos(Math.deg2rad(2 * avghp)) + 0.32 * Math.cos(Math.deg2rad(3 * avghp + 6)) - 0.2 * Math.cos(Math.deg2rad(4 * avghp - 63));

  let deltahp = h2p - h1p;
  if (Math.abs(deltahp) > 180) {
    if (h2p <= h1p) {
      deltahp += 360;
    } else {
      deltahp -= 360;
    }
  }

  const deltalp = l2 - l1;
  const deltacp = c2p - c1p;

  deltahp = 2 * Math.sqrt(c1p * c2p) * Math.sin(Math.deg2rad(deltahp) / 2);

  const sl = 1 + ((0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2)));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;

  const deltaro = 30 * Math.exp(-(Math.pow((avghp - 275) / 25, 2)));
  const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const rt = -rc * Math.sin(2 * Math.deg2rad(deltaro));

  const kl = 1;
  const kc = 1;
  const kh = 1;

  const deltaE = Math.sqrt(Math.pow(deltalp / (kl * sl), 2) + Math.pow(deltacp / (kc * sc), 2) + Math.pow(deltahp / (kh * sh), 2) + rt * (deltacp / (kc * sc)) * (deltahp / (kh * sh)));

  return deltaE;
}
