/*
 * Copyright 2014 Yahoo! Inc. All rights reserved.
 * Licensed under the BSD License.
 * http://yuilibrary.com/license/
 */

var fs          = require('fs'),
    path        = require('path'),
    debug       = require('debug')('hashonym'),
    mkdirp      = require('mkdirp'),
    hashfile    = require('hashfile');

function Hashonym (outputDir, config) {
    this._outputDir     = outputDir;
    this._minHashLen    = config.minHashLen;
    this._ext           = config.ext;
    this._dirty         = true;
    this._fullHashMap   = {};
    this._dirHashMap    = {};

    // add the trailing path separator if it's not there
    if (this._outputDir.charAt(-1) !== path.sep) {
        this._outputDir += path.sep;
    }
}

Hashonym.prototype.add = function (files) {
    // new files could cause hash collisions
    this._dirty = true;

    [].concat(files).forEach(function (file) {
        this._fullHashMap[file] = false;
    }, this);
};

Hashonym.prototype.hashonymize = function (callback) {
    var self = this;

    if (this._dirty) {
        this._generateDirMap(function (err) {
            if (err) {
                return callback(err);
            }

            debug('finished generating the hash directory mapping');

            if (self.dryRun) {
                debug('DRY RUN: returning the hash directory mapping without writing');
                return callback(null, self._dirHashMap);
            }

            return self._write(callback);
        });
    } else {
        process.nextTick(function () {
            return callback(null, self._dirHashMap);
        });
    }
};

Hashonym.prototype._generateHashMap = function (callback) {
    var self = this;

    function run (files) {
        var file = files.shift();

        if (!file) {
            return callback(null);
        }

        // hash has not yet been calculated
        if (!self._fullHashMap[file]) {
            hashfile(file, function (err, hash) {
                if (err) {
                    return callback(err);
                }
                self._fullHashMap[file] = hash;
                run(files);
            });
        } else {
            run(files);
        }
    }

    debug('generating full hashes for each file');
    run(Object.keys(this._fullHashMap));
};

Hashonym.prototype._generateDirMap = function (callback) {
    var self = this;

    this._generateHashMap(function (err) {
        if (err) {
            return callback(err);
        }

        var dirHashMap  = {},
            hashLen     = self._calcMinHashLen();

        Object.keys(self._fullHashMap).reduce(function (map, file) {
            var fullHash    = self._fullHashMap[file],
                shortHash   = fullHash.slice(0, hashLen),
                destFile    = self._outputDir + shortHash;

            if (self._ext) {
                destFile += path.extname(file);
            }

            map[file] = destFile;

            return map;
        }, dirHashMap);

        self._dirHashMap = dirHashMap;
        self._dirty = false;

        debug('generated hash-based file names for each file');
        return callback(null);
    });
};

Hashonym.prototype._write = function (callback) {
    var dirHashMap = this._dirHashMap;

    mkdirp(this._outputDir, function (err) {
        if (err) {
            return callback(err);
        }

        var files   = Object.keys(dirHashMap),
            unique  = 0;

        function run (index) {
            if (index === files.length) {
                debug('started with %d source files', files.length);
                debug('found %d existing hash files', files.length - unique);
                debug('ended with %d generated hash files', unique);
                return callback(null, dirHashMap);
            }

            var srcFile  = files[index],
                destFile = dirHashMap[srcFile];

            fs.exists(destFile, function (exists) {
                if (exists) {
                    debug('%s found, moving on without copying', destFile);
                    index += 1;
                    run(index);
                    return;
                }

                debug('copying the contents of %s out to %s', srcFile, destFile);

                fs.createReadStream(srcFile).pipe(
                    fs.createWriteStream(destFile)
                ).on('finish', function () {
                    debug('finished copying %s to %s', srcFile, destFile);
                    unique += 1;
                    index  += 1;
                    run(index);
                });
            });
        }

        run(0);
    });

    debug('writing all the hash files');
};

Hashonym.prototype._calcMinHashLen = function () {
    var minLen = this._findMinHashLen();

    if (minLen < this._minHashLen) {
        debug('using the minimum configured hash length of %d instead', this._minHashLen);
        minLen = this._minHashLen;
    }

    debug('using %d as the minimum calculated hash length', minLen);
    return minLen;
};

Hashonym.prototype._findMinHashLen = function () {
    var hashLen = 1;

    while (!this._isValidHashLen(hashLen)) {
        hashLen += 1;
    }

    debug('minimum possible hash length is %d', hashLen);
    return hashLen;
};

Hashonym.prototype._isValidHashLen = function (hashLen) {
    var hashonyms = this._fullHashMap,
        files     = Object.keys(hashonyms),
        seen      = {},
        shortHash,
        hashFiles,
        fullHash,
        file,
        len,
        i;

    debug('[hash length %d] checking if valid hash length', hashLen);

    if (hashLen <= 0) {
        return false;
    }

    for (i = 0, len = files.length; i < len; i += 1) {
        file        = files[i];
        fullHash    = hashonyms[file];
        shortHash   = fullHash.slice(0, hashLen);
        hashFiles   = seen[shortHash] = seen[shortHash] || [];

        // if we've seen this short hash before
        if (hashFiles.length) {
            // if this file does not have the same content as the files in the
            // set of files with the same short hash
            if (hashonyms[file] !== hashonyms[hashFiles[0]]) {
                // hash-collision at this hash length, need longer hashes
                debug('[hash length %d] hash collision detected', hashLen);
                return false;
            }
        }

        hashFiles.push(file);
    }

    debug('[hash length %d] is a valid hash length', hashLen);
    return true;
};

module.exports = Hashonym;
