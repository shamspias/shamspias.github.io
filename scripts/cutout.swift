// Lifts the subject out of a photograph and writes a transparent PNG.
//
//   swift scripts/cutout.swift <input.jpg> <output.png>
//
// Uses the same Vision request that backs "Copy Subject" in Preview, so the
// matte follows hair and jacket edges rather than a rectangle. Runs locally with
// no model download and no network.

import AppKit
import CoreImage
import Foundation
import Vision

func die(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else { die("usage: cutout.swift <input> <output.png>") }

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])

guard let source = CIImage(contentsOf: inputURL) else { die("cannot read \(inputURL.path)") }

let handler = VNImageRequestHandler(ciImage: source, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()

do {
    try handler.perform([request])
} catch {
    die("vision failed: \(error.localizedDescription)")
}

guard let observation = request.results?.first else {
    die("no foreground subject found")
}

// Every instance the request found, composited together: a person plus anything
// they are holding comes back as separate instances.
let maskBuffer = try observation.generateScaledMaskForImage(
    forInstances: observation.allInstances,
    from: handler
)

let mask = CIImage(cvPixelBuffer: maskBuffer)

guard let blend = CIFilter(name: "CIBlendWithMask") else { die("filter unavailable") }
blend.setValue(source, forKey: kCIInputImageKey)
blend.setValue(CIImage.empty(), forKey: kCIInputBackgroundImageKey)
blend.setValue(mask, forKey: kCIInputMaskImageKey)

guard let output = blend.outputImage?.cropped(to: source.extent) else { die("compositing failed") }

let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { die("no colour space") }

do {
    try context.writePNGRepresentation(
        of: output,
        to: outputURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )
} catch {
    die("write failed: \(error.localizedDescription)")
}

let w = Int(source.extent.width)
let h = Int(source.extent.height)
print("cut out \(observation.allInstances.count) instance(s) from \(w)x\(h) -> \(outputURL.lastPathComponent)")
