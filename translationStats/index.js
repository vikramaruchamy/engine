let TranslationStats = require('./lib/translationStats');

let mountHandlerMiddleware = require('jsengine/koa/mountHandlerMiddleware');

exports.init = function(app) {
  app.use(mountHandlerMiddleware('/translation-stats', __dirname));
};

exports.boot = async function() {
  if (!process.env.TUTORIAL_EDIT) {
    await TranslationStats.instance().update();
  }
};

exports.TranslationStats = TranslationStats;
