const assert = require('assert');
const fs = require('mz/fs');
const path = require('path');
const config = require('config');
const util = require('util');
const glob = util.promisify(require('glob'));
const log = require('engine/log')();
const yaml = require('js-yaml');
const pixelWidth = require('../lib/pixelWidth');
const execSync = require('child_process').execSync;

async function getImageYaml(imageFile) {
  let content = await fs.readFile(imageFile, 'utf-8');

  let name = path.basename(imageFile);
  let tspans = Array.from(content.matchAll(/<tspan.*?>(.*?)<\/tspan>/g));

  let obj = {
    [name] : Object.create(null)
  };

  for(let match of tspans) {
    if (!match) continue; // empty strings sometimes
    obj[name][match[1]] = "";
  }

  return obj;
}


// Get all strings from image
module.exports = async function() {

  let args = require('yargs')
    .usage('NODE_LANG=ru glp engine:koa:tutorial:figuresTranslate')
    .usage('NODE_LANG=ru glp engine:koa:tutorial:figuresTranslate --image try-catch-flow.svg')
    .usage('NODE_LANG=ru glp engine:koa:tutorial:figuresTranslate --image /path/to/try-catch-flow.svg')
    .argv;

  let images;
  if (args.image) {
    if (args.image.includes('/')) {

      if (!fs.existsSync(args.image)) {
        throw new Error("No such image: " + args.image);
      }

      images = [args.image];

    } else {
      images = await glob(`**/${args.image}`, {cwd: config.tutorialRoot});

      if (!images.length) {
        throw new Error("No such image: " + args.image);
      }
    }

  } else {
    images = await glob(`**/*.svg`, {cwd: config.tutorialRoot});
  }


  console.log("Images", images);


  let imageTranslationsPath = path.join(config.tutorialRoot, 'images.yml');
  let translations = fs.existsSync(imageTranslationsPath) ?
    yaml.safeLoad(fs.readFileSync(imageTranslationsPath, 'utf8')) : Object.create(null);


  for(let image of images) {
    let translation = translations[path.basename(image)];
    if (!translation) {
      continue;
    }

    try {
      execSync(`git rev-parse upstream/master`, {cwd: config.tutorialRoot});
    } catch(err) {
      if (err.status === 128) {
        throw new Error("Git error: no upstream/master. Did you forget to 'git add remote upstream ...'?");
      } else {
        throw err;
      }
    }

    let content = execSync(`git show upstream/master:${image}`, {
      encoding: 'utf-8',
      cwd: config.tutorialRoot
    });

    let translatedContent = content.replace(/(<tspan.*?x=")(.*?)(".*?>)(.*?)(?=<\/tspan>)/g, (match, part1, x, part2, text, offset) => {
      if (!translation[text]) {
        // no such translation
        return match;
      }

      x = +x;

      let translated = translation[text];

      if (typeof translated == 'string') {
        // replace text
        return part1 + x + part2 + translated;
      }

      assert(typeof translated == 'object');

      if (translated.x) {
        x += +translated.x;
      }

      if (translated.position) {
        // Get font family and font-size to calc width
        let fontFamilyIndex = content.lastIndexOf('font-family="', offset);
        let reg = /[^"]+/y;
        reg.lastIndex = fontFamilyIndex + 'font-family="'.length;

        let fontFamily = content.match(reg);

        fontFamily = fontFamily && fontFamily[0];

        let fontSizeIndex = content.lastIndexOf('font-size="', offset);
        reg.lastIndex = fontSizeIndex + 'font-size="'.length;
        let fontSize = content.match(reg);
        fontSize = fontSize && fontSize[0];
        fontSize = +fontSize;

        fontFamily = fontFamily.split(',')[0];

        const widthBefore = pixelWidth({text, font: fontFamily, size: fontSize });
        const widthAfter = pixelWidth({text: translated.text, font: fontFamily, size: fontSize });

        log.debug({
          text,
          fontSize,
          widthBefore,
          widthAfter,
          x,
          position: translated.position
        });

        if (translated.position === "center") {
          x -= (widthAfter - widthBefore) / 2;
        } else if (translated.position === "right") {
          x -= (widthAfter - widthBefore);
        } else {
          throw new Error("Unsupported position: " + translated.position);
        }

        log.debug("New x", x);
      }


      return part1 + x + part2 + translated.text;
    });

    log.debug("translated file", path.join(config.tutorialRoot, image));

    // 1-js/10-error-handling/1-try-catch/try-catch-flow.svg
    fs.writeFileSync(path.join(config.tutorialRoot, image), translatedContent);
  }

};

