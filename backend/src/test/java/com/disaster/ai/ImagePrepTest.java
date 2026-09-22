package com.disaster.ai;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class ImagePrepTest {

    @Test
    void largePhotoIsDownscaledToMaxEdgeKeepingAspectRatio() throws Exception {
        byte[] big = encode(solid(4000, 3000, Color.GRAY), "jpg");

        AiClient.Image out = ImagePrep.forModel(big, "image/jpeg");

        BufferedImage img = decode(out.bytes());
        assertThat(out.mimeType()).isEqualTo("image/jpeg");
        assertThat(img.getWidth()).isEqualTo(ImagePrep.MAX_EDGE);
        assertThat(img.getHeight()).isEqualTo(ImagePrep.MAX_EDGE * 3 / 4);   // 4:3 preserved
        assertThat(out.bytes().length).isLessThan(big.length);
    }

    @Test
    void smallUprightPhotoIsPassedThroughUntouched() throws Exception {
        byte[] small = encode(solid(600, 450, Color.GRAY), "jpg");

        AiClient.Image out = ImagePrep.forModel(small, "image/jpeg");

        assertThat(out.bytes()).isSameAs(small);   // no needless re-encode
    }

    @Test
    void exifOrientation6IsAppliedSoTheModelSeesItUpright() throws Exception {
        // Stored landscape: left half red, right half blue. Orientation 6 = "rotate 90° clockwise
        // to display", which a phone writes for a portrait shot. Displayed correctly, red is on top.
        BufferedImage stored = new BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = stored.createGraphics();
        g.setColor(Color.RED);  g.fillRect(0, 0, 200, 200);
        g.setColor(Color.BLUE); g.fillRect(200, 0, 200, 200);
        g.dispose();
        byte[] jpeg = withExifOrientation(encode(stored, "jpg"), 6);
        assertThat(ImagePrep.exifOrientation(jpeg)).isEqualTo(6);

        BufferedImage shown = decode(ImagePrep.forModel(jpeg, "image/jpeg").bytes());

        assertThat(shown.getWidth()).isEqualTo(200);
        assertThat(shown.getHeight()).isEqualTo(400);
        assertThat(isReddish(shown.getRGB(100, 50))).as("top should be red").isTrue();
        assertThat(isBluish(shown.getRGB(100, 350))).as("bottom should be blue").isTrue();
    }

    @Test
    void transparentPngBecomesWhiteNotBlack() throws Exception {
        BufferedImage clear = new BufferedImage(2000, 1000, BufferedImage.TYPE_INT_ARGB); // fully transparent

        BufferedImage out = decode(ImagePrep.forModel(encode(clear, "png"), "image/png").bytes());

        Color c = new Color(out.getRGB(10, 10));
        assertThat(c.getRed()).isGreaterThan(240);
        assertThat(c.getGreen()).isGreaterThan(240);
        assertThat(c.getBlue()).isGreaterThan(240);
    }

    @Test
    void undecodableBytesFallBackToTheOriginal() {
        byte[] junk = "definitely not an image".getBytes();

        AiClient.Image out = ImagePrep.forModel(junk, "image/jpeg");

        assertThat(out.bytes()).isSameAs(junk);
        assertThat(ImagePrep.exifOrientation(junk)).isEqualTo(1);
    }

    @Test
    void webpIsSentAsIsBecauseTheJdkCannotDecodeIt() {
        byte[] webp = new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

        assertThat(ImagePrep.forModel(webp, "image/webp").bytes()).isSameAs(webp);
    }

    // ---------------------------------------------------------------- helpers

    private static BufferedImage solid(int w, int h, Color c) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillRect(0, 0, w, h);
        g.dispose();
        return img;
    }

    private static byte[] encode(BufferedImage img, String format) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    private static BufferedImage decode(byte[] bytes) throws Exception {
        return ImageIO.read(new ByteArrayInputStream(bytes));
    }

    /** Inserts a minimal big-endian EXIF APP1 segment holding only the Orientation tag. */
    private static byte[] withExifOrientation(byte[] jpeg, int orientation) {
        byte[] app1 = {
                (byte) 0xFF, (byte) 0xE1, 0x00, 0x22,                  // APP1, length 34
                'E', 'x', 'i', 'f', 0x00, 0x00,                        // Exif header
                'M', 'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,          // TIFF header, IFD0 at offset 8
                0x00, 0x01,                                            // 1 entry
                0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,        // tag 0x0112, SHORT, count 1
                0x00, (byte) orientation, 0x00, 0x00,                  // value
                0x00, 0x00, 0x00, 0x00                                 // no next IFD
        };
        byte[] out = new byte[jpeg.length + app1.length];
        System.arraycopy(jpeg, 0, out, 0, 2);                          // SOI
        System.arraycopy(app1, 0, out, 2, app1.length);
        System.arraycopy(jpeg, 2, out, 2 + app1.length, jpeg.length - 2);
        return out;
    }

    private static boolean isReddish(int rgb) {
        Color c = new Color(rgb);
        return c.getRed() > 180 && c.getBlue() < 80;
    }

    private static boolean isBluish(int rgb) {
        Color c = new Color(rgb);
        return c.getBlue() > 180 && c.getRed() < 80;
    }
}
