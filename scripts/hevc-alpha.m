// Writes a folder of RGBA PNG frames as HEVC with alpha (.mov), with Apple's own encoder: the
// transparent video Safari plays. (ffmpeg's hevc_videotoolbox output with alpha isn't read by
// macOS's decoder.) Built and run by scripts/clip_video.py:
//   hevc-alpha <frames-dir> <out.mov> <fps-num> <fps-den> <quality 0-1> <alpha quality 0-1>
// Frames are read in name order; every frame is one frame at the given rate.
#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <ImageIO/ImageIO.h>
#import <VideoToolbox/VideoToolbox.h>

static CVPixelBufferRef bufferFor(CGImageRef img, CVPixelBufferPoolRef pool) {
  CVPixelBufferRef buf = NULL;
  CVPixelBufferPoolCreatePixelBuffer(NULL, pool, &buf);
  CVPixelBufferLockBaseAddress(buf, 0);
  size_t w = CVPixelBufferGetWidth(buf), h = CVPixelBufferGetHeight(buf);
  CGContextRef ctx = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(buf), w, h, 8, CVPixelBufferGetBytesPerRow(buf),
                                           CGColorSpaceCreateWithName(kCGColorSpaceSRGB),
                                           kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little);
  CGContextClearRect(ctx, CGRectMake(0, 0, w, h));
  CGContextDrawImage(ctx, CGRectMake(0, 0, w, h), img);
  CGContextRelease(ctx);
  CVPixelBufferUnlockBaseAddress(buf, 0);
  return buf;
}

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc < 7) {
      fprintf(stderr, "usage: hevc-alpha <frames-dir> <out.mov> <fps-num> <fps-den> <quality> <alpha-quality>\n");
      return 2;
    }
    NSString *dir = @(argv[1]);
    NSURL *out = [NSURL fileURLWithPath:@(argv[2])];
    int32_t num = atoi(argv[3]), den = atoi(argv[4]);
    double quality = atof(argv[5]), alphaQuality = atof(argv[6]);
    NSArray<NSString *> *names = [[[NSFileManager defaultManager] contentsOfDirectoryAtPath:dir error:nil]
        sortedArrayUsingSelector:@selector(compare:)];
    names = [names filteredArrayUsingPredicate:[NSPredicate predicateWithFormat:@"self ENDSWITH '.png'"]];
    if (names.count == 0) return 1;

    CGImageRef (^load)(NSString *) = ^CGImageRef(NSString *name) {
      NSURL *u = [NSURL fileURLWithPath:[dir stringByAppendingPathComponent:name]];
      CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)u, NULL);
      CGImageRef img = CGImageSourceCreateImageAtIndex(src, 0, NULL);
      CFRelease(src);
      return img;
    };
    CGImageRef first = load(names[0]);
    size_t w = CGImageGetWidth(first), h = CGImageGetHeight(first);
    CGImageRelease(first);

    [[NSFileManager defaultManager] removeItemAtURL:out error:nil];
    NSError *err = nil;
    AVAssetWriter *writer = [AVAssetWriter assetWriterWithURL:out fileType:AVFileTypeQuickTimeMovie error:&err];
    if (!writer) { NSLog(@"%@", err); return 1; }
    NSDictionary *settings = @{
      AVVideoCodecKey: AVVideoCodecTypeHEVCWithAlpha,
      AVVideoWidthKey: @(w),
      AVVideoHeightKey: @(h),
      // Tagged as what it is (sRGB pictures, Rec. 709 primaries and matrix), so the browser shows
      // the same colours as the still pictures around it rather than guessing a TV transfer curve.
      AVVideoColorPropertiesKey: @{
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: (__bridge NSString *)kCVImageBufferTransferFunction_sRGB,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
      },
      AVVideoCompressionPropertiesKey: @{
        AVVideoQualityKey: @(quality),
        (__bridge NSString *)kVTCompressionPropertyKey_TargetQualityForAlpha: @(alphaQuality),
        AVVideoAllowFrameReorderingKey: @NO,
      },
    };
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
    input.expectsMediaDataInRealTime = NO;
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor
        assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input
                                   sourcePixelBufferAttributes:@{
                                     (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
                                     (NSString *)kCVPixelBufferWidthKey: @(w),
                                     (NSString *)kCVPixelBufferHeightKey: @(h),
                                   }];
    [writer addInput:input];
    [writer startWriting];
    [writer startSessionAtSourceTime:kCMTimeZero];
    for (NSUInteger i = 0; i < names.count; i++) {
      while (!input.readyForMoreMediaData) [NSThread sleepForTimeInterval:0.005];
      CGImageRef img = load(names[i]);
      CVPixelBufferRef buf = bufferFor(img, adaptor.pixelBufferPool);
      CGImageRelease(img);
      if (![adaptor appendPixelBuffer:buf withPresentationTime:CMTimeMake((int64_t)i * den, num)]) {
        NSLog(@"append failed at %lu: %@", (unsigned long)i, writer.error);
        return 1;
      }
      CVPixelBufferRelease(buf);
    }
    [input markAsFinished];
    // the last frame is held for one frame's length
    [writer endSessionAtSourceTime:CMTimeMake((int64_t)names.count * den, num)];
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{ dispatch_semaphore_signal(done); }];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    if (writer.status != AVAssetWriterStatusCompleted) { NSLog(@"%@", writer.error); return 1; }
  }
  return 0;
}
