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
    await rimraf('./.temp/*', {
        'glob': true
    });

    const metaConfig = await fs.readFile("./meta.json", 'utf-8');
    const meta = safeParse(metaConfig);

    const validFolders = (await fs.readdir('.', {
        'withFileTypes': true
    })).filter(it => it.isDirectory() && !it.name.startsWith('.') && !exceptionFolders.includes(it.name)).sort((a, b) => a.name.localeCompare(b.name));
    const themeConfigs = await Promise.all(validFolders.map(async folder => {
        try {
            const themeMeta = meta[folder.name] || {};
            meta[folder.name] = themeMeta;

            // INIT META
            if (!themeMeta.id) {
                themeMeta.id = nanoid();
            }

            // copy to temp folder
            await fs.cp(`./${folder.name}`, `./.temp/${folder.name}`, {
                recursive: true
            });
            

            const rawConfig = JSON.parse(await fs.readFile(`./${folder.name}/config.json`, 'utf-8'));

            const mergedConfig = {
                ...rawConfig,
                ...themeMeta
            };

            const mergedConfigStr = JSON.stringify(mergedConfig);
            await fs.writeFile(`./.temp/${folder.name}/config.json`, mergedConfigStr, 'utf-8');
            
            const hash = CryptoJS.MD5(mergedConfigStr).toString(CryptoJS.enc.Hex);

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
            archive.directory(`./.temp/${folder.name}`, false);
            archive.finalize();
            await promise;

            
            return {
                publishName: outputName,
                packageName: folder.name,
                hash,
                config: mergedConfig,
                ...themeMeta         
            }

        } catch(e) {
            return null;
        } finally {
            await rimraf(`./.temp/${folder.name}`);
        }
    }))
    await fs.writeFile('./.publish/publish.json', JSON.stringify(themeConfigs), 'utf-8');
    await fs.writeFile('./meta.json', JSON.stringify(meta, undefined, 4), 'utf-8');

    console.log("Publish Done");

}

publish();