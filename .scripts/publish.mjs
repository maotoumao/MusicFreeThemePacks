import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import archiver from 'archiver';
import { rimraf } from 'rimraf';
import CryptoJS from 'crypto-js';
import { nanoid } from 'nanoid';

const exceptionFolders = ['node_modules'];

function safeParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return {};
    }
}

async function publish() {
    await rimraf('./.publish/*', {
        'glob': true
    });

    const metaConfig = await fs.readFile("./meta.json", 'utf-8');
    const meta = safeParse(metaConfig);

    const validFolders = (await fs.readdir('.', {
        'withFileTypes': true
    })).filter(it => it.isDirectory() && !it.name.startsWith('.') && !exceptionFolders.includes(it.name)).sort((a, b) => a.name.localeCompare(b.name));
    const themeConfigs = await Promise.all(validFolders.map(async folder => {
        try {
            const configFile = await fs.readFile(`./${folder.name}/config.json`, 'utf-8');

            const hash = CryptoJS.MD5(configFile).toString(CryptoJS.enc.Hex);

            const archive = archiver('zip');
            const outputName = `${folder.name}-${hash}`;
            const outputPath = `./.publish/${outputName}.mftheme`
            const output = createWriteStream(outputPath);
            const promise = new Promise((resolve, reject) => {
                archive.on('end', resolve);
                archive.on('close', resolve);
                archive.on('error', reject);
            });


            archive.pipe(output);
            archive.directory(`./${folder.name}`, false);
            archive.finalize();
            await promise;

            const config = JSON.parse(configFile);
            config.hash = hash;

            // meta
            const themeMeta = meta[folder.name] || {};
            if (!themeMeta.id) {
                themeMeta.id = nanoid();
            }

            meta[folder.name] = themeMeta;
            
            return {
                publishName: outputName,
                packageName: folder.name,
                hash,
                config,
                ...themeMeta,                
            }

        } catch(e) {
            // ignore
            console.log(2, e)
            return null;
        }
    }))
    await fs.writeFile('./.publish/publish.json', JSON.stringify(themeConfigs), 'utf-8');
    await fs.writeFile('./meta.json', JSON.stringify(meta, undefined, 4), 'utf-8');

    console.log("Publish Done");

}

publish();