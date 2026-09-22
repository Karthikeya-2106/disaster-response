package com.disaster.ai;

import lombok.extern.slf4j.Slf4j;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

/**
 * Shrinks a photo before it goes to a vision model. The stored original is untouched.
 *
 * <p>Citizen photos come straight off phones at 12+ megapixels. Sent as-is, one image costs
 * thousands of tokens: minutes of prefill on a CPU-only Ollama box, a real risk of overflowing
 * the default 4096-token context, and a faster drain on Gemini's free quota.
 *
 * <p>Why {@value #MAX_EDGE}px: reading the image dominates CPU time (measured: 278 s of prefill
 * vs 15 s of generation for one photo at ~1000 px). Qwen2.5-VL spends one token per 28×28 px
 * patch, so 768 px roughly halves that; Gemini bills images in 768×768 tiles, so 768 px is one
 * tile instead of two. A scene-level call — flood, smoke, blocked road — doesn't need more.
 *
 * <p>Phone JPEGs usually store pixels in sensor orientation plus an EXIF rotation tag, which
 * {@code ImageIO} ignores. Re-encoding without honouring it would hand the model a sideways
 * picture, so the tag is read and applied here.
 */
@Slf4j
public final class ImagePrep {

    public static final int MAX_EDGE = 768;

    private ImagePrep() {}

    public static AiClient.Image forModel(byte[] bytes, String mime) {
        AiClient.Image original = new AiClient.Image(bytes, mime);
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime)) return original; // no WebP reader in the JDK
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(bytes));
            if (src == null) return original;

            int orientation = "image/jpeg".equals(mime) ? exifOrientation(bytes) : 1;
            boolean quarterTurn = orientation == 6 || orientation == 8;
            int w = quarterTurn ? src.getHeight() : src.getWidth();
            int h = quarterTurn ? src.getWidth() : src.getHeight();
            double scale = Math.min(1.0, (double) MAX_EDGE / Math.max(w, h));
            if (scale == 1.0 && orientation == 1) return original;   // already fine; don't re-encode

            int outW = Math.max(1, (int) Math.round(w * scale));
            int outH = Math.max(1, (int) Math.round(h * scale));
            BufferedImage out = new BufferedImage(outW, outH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.setColor(Color.WHITE);                  // PNG transparency -> white, not black
                g.fillRect(0, 0, outW, outH);
                AffineTransform t = new AffineTransform();
                switch (orientation) {
                    case 3 -> { t.translate(outW, outH); t.rotate(Math.PI); }
                    case 6 -> { t.translate(outW, 0); t.rotate(Math.PI / 2); }
                    case 8 -> { t.translate(0, outH); t.rotate(-Math.PI / 2); }
                    default -> { }
                }
                t.scale(scale, scale);
                g.drawImage(src, t, null);
            } finally {
                g.dispose();
            }
            byte[] jpeg = encodeJpeg(out, 0.85f);
            log.debug("Prepared image for model: {}x{} ({} bytes) -> {}x{} ({} bytes), orientation {}",
                    src.getWidth(), src.getHeight(), bytes.length, outW, outH, jpeg.length, orientation);
            return new AiClient.Image(jpeg, "image/jpeg");
        } catch (Exception | OutOfMemoryError e) {
            // CMYK JPEGs and other oddities ImageIO can't decode: send the original rather than nothing.
            log.debug("Could not downscale image, sending original: {}", e.toString());
            return original;
        }
    }

    private static byte[] encodeJpeg(BufferedImage img, float quality) throws Exception {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(buf)) {
            writer.setOutput(ios);
            ImageWriteParam p = writer.getDefaultWriteParam();
            p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            p.setCompressionQuality(quality);
            writer.write(null, new IIOImage(img, null, null), p);
        } finally {
            writer.dispose();
        }
        return buf.toByteArray();
    }

    /**
     * Reads the EXIF Orientation tag (0x0112) from IFD0 of a JPEG's APP1 segment.
     * Returns 1 (normal) when absent or unreadable. Mirrored orientations are treated as normal.
     */
    static int exifOrientation(byte[] b) {
        try {
            if (b.length < 4 || (b[0] & 0xFF) != 0xFF || (b[1] & 0xFF) != 0xD8) return 1;
            int i = 2;
            while (i + 4 <= b.length) {
                if ((b[i] & 0xFF) != 0xFF) return 1;
                int marker = b[i + 1] & 0xFF;
                if (marker == 0xDA || marker == 0xD9) return 1;          // image data starts; no EXIF
                int len = ((b[i + 2] & 0xFF) << 8) | (b[i + 3] & 0xFF);
                int seg = i + 4;
                if (marker == 0xE1 && seg + 14 <= b.length
                        && b[seg] == 'E' && b[seg + 1] == 'x' && b[seg + 2] == 'i' && b[seg + 3] == 'f') {
                    int tiff = seg + 6;
                    boolean le = b[tiff] == 'I';
                    int ifd = tiff + (int) readUInt(b, tiff + 4, 4, le);
                    int count = (int) readUInt(b, ifd, 2, le);
                    for (int e = 0; e < count; e++) {
                        int entry = ifd + 2 + e * 12;
                        if (entry + 12 > b.length) return 1;
                        if (readUInt(b, entry, 2, le) == 0x0112) {
                            int v = (int) readUInt(b, entry + 8, 2, le);
                            return (v == 3 || v == 6 || v == 8) ? v : 1;
                        }
                    }
                    return 1;
                }
                i = seg + len - 2;
            }
        } catch (RuntimeException ignored) { }
        return 1;
    }

    private static long readUInt(byte[] b, int off, int n, boolean littleEndian) {
        long v = 0;
        for (int k = 0; k < n; k++) {
            int by = b[off + (littleEndian ? n - 1 - k : k)] & 0xFF;
            v = (v << 8) | by;
        }
        return v;
    }
}
