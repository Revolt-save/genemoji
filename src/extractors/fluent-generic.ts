import { existsSync } from "fs"
import { copyFile, mkdir, readdir, readFile, writeFile } from "fs/promises"
import { join as joinPath } from "path"
import { packsDir } from "../app.js"
import {
    FLUENT_TONE_DIRS,
    FLUENT_TONE_DIR_TO_CODEPOINT,
    VARIANT_SELECTOR_EMOJI,
} from "../constants.js"
import { MSFTMetadataFile } from "../types.js"

// We embed the 3D PNGs in an SVG so that we can use the same URLs for every pack
const embedPngInSvg = (
    png: Buffer
) => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<image width="32" height="32" xlink:href="data:image/png;base64,${png.toString(
    "base64"
)}"/>
</svg>`

const copyWithSkinTones = async (
    copyTo: string,
    flavorName: string,
    emojiPath: string,
    codepoints: string[]
) => {
    for (let tone of FLUENT_TONE_DIRS) {
        const toneDir = joinPath(emojiPath, tone, flavorName)
        if (!existsSync(toneDir)) {
            console.log(
                "Warning:",
                toneDir.replace(process.cwd(), ""),
                "is missing, this is likely an issue with the pack. Will be provided by twemoji"
            )
            continue
        }

        const codepointOfEmoji =
            tone === "Default"
                ? codepoints
                : [
                      codepoints[0],
                      FLUENT_TONE_DIR_TO_CODEPOINT[tone],
                      ...codepoints.slice(1),
                  ]

        const fileName = (await readdir(toneDir)).filter(
            (x) => x.endsWith(".svg") || x.endsWith(".png")
        )[0]

        const inPath = joinPath(toneDir, fileName)
        const outPath = joinPath(copyTo, codepointOfEmoji.join("-") + ".svg")

        if (fileName.endsWith(".png")) {
            const pngData = await readFile(inPath)
            await writeFile(outPath, embedPngInSvg(pngData))
        } else {
            await copyFile(inPath, outPath)
        }
    }
}

const copySingle = async (
    copyTo: string,
    flavorName: string,
    emojiPath: string,
    codepoints: string[]
) => {
    const assetDir = joinPath(emojiPath, flavorName)
    if (!existsSync(assetDir)) {
        console.log(
            "Warning:",
            assetDir.replace(process.cwd(), ""),
            "is missing, this is likely an issue with the pack. Will be provided by twemoji"
        )
        return
    }
    const fileName = (await readdir(assetDir)).filter(
        (x) => x.endsWith(".svg") || x.endsWith(".png")
    )[0]

    const inPath = joinPath(assetDir, fileName)
    const outPath = joinPath(
        copyTo,
        codepoints.filter((x) => x !== VARIANT_SELECTOR_EMOJI).join("-") +
            ".svg"
    )

    if (fileName.endsWith(".png")) {
        const pngData = await readFile(inPath)
        await writeFile(outPath, embedPngInSvg(pngData))
    } else {
        await copyFile(inPath, outPath)
    }
}

export const copyFluent = async (flavorName: string, toPath: string) => {
    const fluentEmojiDir = joinPath(packsDir, "fluent", "assets")
    const emojis = await readdir(fluentEmojiDir)

    if (!existsSync(toPath)) await mkdir(toPath)

    for (let emoji of emojis) {
        const emojiPath = joinPath(fluentEmojiDir, emoji)
        const emojiDirContents = (await readdir(emojiPath)).filter(
            (x) => !x.endsWith(".json")
        )

        const metadataFile: MSFTMetadataFile = JSON.parse(
            (await readFile(joinPath(emojiPath, "metadata.json"))).toString()
        )
        const codepoints = metadataFile.unicode.split(" ")

        const hasSkinTones = emojiDirContents.includes("Medium-Dark") // name unlikely to be reused

        if (hasSkinTones) {
            copyWithSkinTones(toPath, flavorName, emojiPath, codepoints)
        } else {
            copySingle(toPath, flavorName, emojiPath, codepoints)
        }
    }
}
