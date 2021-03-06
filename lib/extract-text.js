'use strict';
const _debug = require('debug')('pdftotext-stdin');
const Promise = require('bluebird');
const spawn = require('child_process').spawn;
const { parseOptions } = require('./parse-options');
const pipe = require('pump');
const concatStream = require('concat-stream');

const pdf2TxtCmd = 'pdftotext';

function _spawnPdfToTtext(args) {
    _debug('Spawning ', pdf2TxtCmd, args.join(' '));
    return spawn(
        pdf2TxtCmd,
        args,
        { stdio: ['pipe', 'pipe', 'pipe'] }
    );
}

function awaitProcess(process) {
    return new Promise(
        (resolve, reject) => {
            process.on('close', code => {
                _debug(pdf2TxtCmd, 'exited with code', code);
                if (code !== 0) {
                    return reject(code);
                } else {
                    return resolve();
                }
            });
        }
    );
}

function _execPdfToText(pdfStream, pdf2TxtArgs, outputStream) {
    const pdf2TxtProc = _spawnPdfToTtext(pdf2TxtArgs);

    const processPromise = awaitProcess(pdf2TxtProc);

    return new Promise(
        (resolve, reject) => {
            pdf2TxtProc.stderr.setEncoding('utf8');
            pdf2TxtProc.stderr.on('data', e => {
                _debug('pdftotext [stderr]', e);
                reject(e);
            });

            pipe(pdfStream, pdf2TxtProc.stdin, err => {
                if (err) {
                    _debug('STDIN PIPE ERR!', err);
                }
            });

            pipe(pdf2TxtProc.stdout, outputStream, async err => {
                if (err) {
                    _debug('STDOUT PIPE ERR!', err);
                    reject(err);
                }
                try {
                    await processPromise;
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }
    );
}

function streamTextFromPdfStream(pdfStream, outputStream, options = {}) {
    const pdf2TxtArgs = parseOptions(options);
    return _execPdfToText(pdfStream, pdf2TxtArgs, outputStream);
}

function extractTextFromPdfStream(pdfStream, options = {}) {
    return new Promise(
        (resolve, reject) => {
            const outputStream = concatStream(
                { encoding: 'string' },
                async (d) => {
                    await streamPromise;
                    return d.length > 0 ? resolve(d) : reject(Error('Empty pdftotext result.'));
                }
            );

            const streamPromise = streamTextFromPdfStream(pdfStream, outputStream, options).catch(reject);
        }
    );
}

module.exports = { extractTextFromPdfStream };
