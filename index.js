'use strict';

var path = require('path'),
  fs = require('fs');

var INCLUDE_RE = /\!{3}\s*include\s*\(\s*(.+?)\s*\)\s*\!{3}/i;

module.exports = function include_plugin(md, options) {
  var root = '.',
    includeRe = INCLUDE_RE;

  if (options) {
    if (typeof options === 'string') {
      root = options;
    } else {
      root = options.root || root;
      includeRe = options.includeRe || includeRe;
    }
  }

  function format(url) {
    var [filePath, strs] = url.split('?')
    var queryString;
    if (strs) {
      queryString = {};
      strs = strs.split('&');
      strs.forEach((str) => {
        var params = str.split('=');
        queryString[params[0]] = params[1];
      });
    }
    return {
      queryString: queryString,
      url: filePath
    }
  }
  function tplEngine(tpl, data, regexp) {
    if (!(Object.prototype.toString.call(data) === '[object Array]')) {
      data = [data];
    }
    let ret = [];
    let replaceAction = (object) => {
      return tpl.replace(regexp || (/\\?\{\{([^}]+)\}\}/g), (match, name) => {
        if (match.charAt(0) === '\\') return match.slice(1);
        return (object[name] !== undefined) ? object[name] : '{' + name + '}';
      });
    };
    for (let i = 0, j = data.length; i < j; i++) {
      ret.push(replaceAction(data[i]));
    }
    return ret.join('');
  }
  function appendBtn(mdSrc, url, filePath) {
    var ulength = url.split("/").length;
    var filePathArray = filePath.split("/");
    var path = "";
    for (let i = filePathArray.length - ulength; i < filePathArray.length; i++) {
      if (path == "") {
        path = filePathArray[i];
      } else {
        path += "/" + filePathArray[i];
      }
    }
    var str = "\r\n\r\n";
    str += "::: danger \r\n\r\n";
    str += "::: tip \r\n\r\n";
    str += "::: warning 下方文档文件地址: " + path + "\r\n\r\n";
    str += "[跳转到GitLab页面编辑此文档](https://gitlab2.rongcloud.net/docs-team/developer-docs/-/blob/dev/"
      + path + ")\r\n:::\r\n:::\r\n:::\r\n---\r\n";

    return str + mdSrc;
  }

  function _replaceIncludeByContent(src, rootdir, parentFilePath, filesProcessed) {
    filesProcessed = filesProcessed ? filesProcessed.slice() : []; // making a copy
    var cap, filePath, mdSrc, indexOfCircularRef;

    // store parent file path to check circular references
    if (parentFilePath) {
      filesProcessed.push(parentFilePath);
    }
    while ((cap = includeRe.exec(src))) {
      var app = format(cap[1].trim())
      filePath = path.resolve(rootdir, app.url);

      // check if circular reference
      indexOfCircularRef = filesProcessed.indexOf(filePath);
      if (indexOfCircularRef !== -1) {
        throw new Error('Circular reference between ' + filePath + ' and ' + filesProcessed[indexOfCircularRef]);
      }

      // replace include by file content
      var isExist = fs.existsSync(filePath);
      if (isExist) {
        mdSrc = fs.readFileSync(filePath, 'utf8');
        var queryString = app.queryString;
        if (queryString) {
          mdSrc = tplEngine(mdSrc, queryString);
        }
        mdSrc = _replaceIncludeByContent(mdSrc, path.dirname(filePath), filePath, filesProcessed);
      }
      src = src.slice(0, cap.index) + appendBtn(mdSrc, app.url, filePath) + src.slice(cap.index + cap[0].length, src.length);

    }
    return src;
  }

  function _includeFileParts(state) {
    state.src = _replaceIncludeByContent(state.src, root);
  }

  md.core.ruler.before('normalize', 'include', _includeFileParts);
};