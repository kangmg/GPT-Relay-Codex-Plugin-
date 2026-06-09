#import <AppKit/AppKit.h>

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 3) {
      fprintf(stderr, "usage: %s <image-path> <mime-type>\\n", argv[0]);
      return 2;
    }

    NSString *path = [NSString stringWithUTF8String:argv[1]];
    NSString *mimeType = [NSString stringWithUTF8String:argv[2]];
    NSData *originalData = [NSData dataWithContentsOfFile:path];
    if (!originalData) {
      fprintf(stderr, "could not read image data\\n");
      return 3;
    }

    NSImage *image = [[NSImage alloc] initWithContentsOfFile:path];
    if (!image) {
      fprintf(stderr, "could not read image\\n");
      return 3;
    }

    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    [pasteboard clearContents];
    NSMutableArray<NSPasteboardType> *types = [NSMutableArray array];
    NSPasteboardType originalType = NSPasteboardTypePNG;
    if ([mimeType isEqualToString:@"image/jpeg"]) {
      originalType = @"public.jpeg";
    }
    [types addObject:originalType];
    [types addObject:NSPasteboardTypeTIFF];
    [pasteboard declareTypes:types owner:nil];

    BOOL ok = [pasteboard setData:originalData forType:originalType];
    NSData *tiffData = [image TIFFRepresentation];
    if (tiffData) {
      ok = [pasteboard setData:tiffData forType:NSPasteboardTypeTIFF] || ok;
    }
    ok = [pasteboard writeObjects:@[ image ]] || ok;
    if (!ok) {
      fprintf(stderr, "could not write image to pasteboard\\n");
      return 4;
    }
  }

  return 0;
}
