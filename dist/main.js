#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs-extra");
var serializer = require("js-yaml");
var program = require("commander");
var jsonTraverse_1 = require("./jsonTraverse");
var postTransformer_1 = require("./postTransformer");
var tocGenerator_1 = require("./tocGenerator");
var packageGenerator_1 = require("./packageGenerator");
var moduleGenerator_1 = require("./moduleGenerator");
var idResolver_1 = require("./idResolver");
var constants_1 = require("./common/constants");
var flags_1 = require("./common/flags");
var pjson = require('../package.json');
var path;
var outputPath;
var repoConfigPath;
program
    .version("v" + pjson.version)
    .description('A tool to convert the json format api file generated by TypeDoc to yaml format output files for docfx.')
    .option('--hasModule', 'Add the option if the source repository contains module.')
    .option('--disableAlphabetOrder', 'Add the option if you want to disable the alphabet order in output yaml.')
    .option('--basePath [value]', 'Current base path to the repository.')
    .option('--sourceUrl [value]', 'Define the source repository address.')
    .option('--sourceBranch [value]', 'Define the branch of source repository.')
    .arguments('<inputFile> <outputFolder> [repoConfigureFile]')
    .action(function (input, output, repoConfig) {
    path = input;
    outputPath = output;
    repoConfigPath = repoConfig;
})
    .parse(process.argv);
if (!path || !outputPath) {
    console.log('Error: The input file path and output folder path is not specified!');
    program.help();
}
var repoConfig;
if (repoConfigPath && program.basePath) {
    if (fs.existsSync(repoConfigPath)) {
        var temp = JSON.parse(fs.readFileSync(repoConfigPath).toString());
        repoConfig = {
            repo: temp.repo,
            branch: temp.branch,
            basePath: program.basePath
        };
    }
    else {
        console.log("Error: repository config file path {" + repoConfigPath + "} doesn't exit!");
        program.help();
    }
}
if (!repoConfig && program.sourceUrl && program.sourceBranch && program.basePath) {
    repoConfig = {
        repo: program.sourceUrl,
        branch: program.sourceBranch,
        basePath: program.basePath
    };
}
if (program.hasModule) {
    flags_1.flags.hasModule = true;
}
if (program.disableAlphabetOrder) {
    flags_1.flags.enableAlphabetOrder = false;
}
var json = null;
if (fs.existsSync(path)) {
    var dataStr = fs.readFileSync(path).toString();
    json = JSON.parse(dataStr);
}
else {
    console.error('Api doc file ' + path + ' doesn\'t exist.');
    program.help();
}
var rootElements = [];
var uidMapping = {};
if (json) {
    jsonTraverse_1.traverse(json, '', rootElements, null, uidMapping, repoConfig);
}
if (rootElements && rootElements.length) {
    idResolver_1.resolveIds(rootElements, uidMapping);
    postTransformer_1.groupGlobalFunction(rootElements);
    var flattenElements = rootElements.map(function (rootElement) {
        if (rootElement.uid.indexOf('constructor') >= 0) {
            return [];
        }
        return postTransformer_1.postTransform(rootElement);
    }).reduce(function (a, b) {
        return a.concat(b);
    }, []);
    console.log('Yaml dump start.');
    flattenElements.forEach(function (transfomredClass) {
        transfomredClass = JSON.parse(JSON.stringify(transfomredClass));
        var filename = transfomredClass.items[0].uid.replace(transfomredClass.items[0].package + ".", '');
        filename = filename.split('(')[0];
        console.log("Dump " + outputPath + "/" + filename + ".yml");
        fs.writeFileSync(outputPath + "/" + filename + ".yml", constants_1.yamlHeader + "\n" + serializer.safeDump(transfomredClass));
    });
    console.log('Yaml dump end.');
    var yamlModels_1 = [];
    flattenElements.forEach(function (element) {
        yamlModels_1.push(element.items[0]);
    });
    var packageIndex = packageGenerator_1.generatePackage(yamlModels_1);
    packageIndex = JSON.parse(JSON.stringify(packageIndex));
    fs.writeFileSync(outputPath + "/index.yml", constants_1.yamlHeader + "\n" + serializer.safeDump(packageIndex));
    console.log('Package index genrated.');
    var toc = tocGenerator_1.generateToc(yamlModels_1, flattenElements[0].items[0].package);
    toc = JSON.parse(JSON.stringify(toc));
    fs.writeFileSync(outputPath + "/toc.yml", serializer.safeDump(toc));
    console.log('Toc genrated.');
    if (flags_1.flags.hasModule) {
        var moduleIndexes = moduleGenerator_1.generateModules(toc[0].items);
        moduleIndexes.forEach(function (moduleIndex) {
            moduleIndex = JSON.parse(JSON.stringify(moduleIndex));
            fs.writeFileSync(outputPath + "/" + moduleIndex.items[0].uid + ".yml", constants_1.yamlHeader + "\n" + serializer.safeDump(moduleIndex));
        });
        console.log('Module indexes generated.');
    }
}
