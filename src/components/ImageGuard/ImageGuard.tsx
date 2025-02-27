import { Button, Group, Popover, Stack, ThemeIcon, Text, Badge, Box, Sx } from '@mantine/core';
import { NextLink } from '@mantine/next';
import { IconEye, IconEyeOff, IconLock, IconPlus } from '@tabler/icons';
import { useRouter } from 'next/router';
import React, { cloneElement, createContext, useContext, useState } from 'react';
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { useCurrentUser } from '~/hooks/useCurrentUser';
import { ImageModel } from '~/server/selectors/image.selector';
import { isDefined } from '~/utils/type-guards';

export type ImageGuardConnect = {
  entityType: 'model' | 'modelVersion' | 'review' | 'user';
  entityId: number;
};
// #region [store]
type SfwStore = {
  showingConnections: Record<string, boolean>;
  showingImages: Record<string, boolean>;
  toggleImage: (id: number) => void;
  showImages: (ids: number[]) => void;
  toggleConnection: ({ entityType, entityId }: ImageGuardConnect) => void;
};
const getConnectionKey = ({ entityId, entityType }: ImageGuardConnect) =>
  `${entityId}_${entityType}`;
const useStore = create<SfwStore>()(
  immer((set) => ({
    showingConnections: {},
    showingImages: {},

    toggleImage: (id) => {
      set((state) => {
        state.showingImages[id.toString()] = !state.showingImages[id.toString()];
      });
    },
    showImages: (ids) => {
      set((state) => {
        ids.map((id) => (state.showingImages[id.toString()] = true));
      });
    },
    toggleConnection: (args) => {
      set((state) => {
        const key = getConnectionKey(args);
        state.showingConnections[key] = !state.showingConnections[key];
      });
    },
  }))
);
// #endregion

// #region [ImageGuardContext]
type ImageGuardState = {
  images: Array<ImageModel & { imageNsfw: boolean }>;
  connect?: ImageGuardConnect;
};
const ImageGuardCtx = createContext<ImageGuardState>({} as any);
const useImageGuardContext = () => {
  const context = useContext(ImageGuardCtx);
  if (!context) throw new Error('useImageGuardContext can only be used inside ImageGuardCtx');
  return context;
};
// #endregion

/**NOTES**
  - `connect` allows our images to be managed by a parent entity.
    - use case: home page, model card, toggle image - since I don't have all the images yet, I need to be able to still manage nsfw state for all the images without having the knowledge of which images are nsfw
*/

type CustomImageModel = ImageModel & { imageNsfw?: boolean };

type ImageGuardProps = {
  images: CustomImageModel[];
  connect?: ImageGuardConnect;
  render: (image: ImageModel, index: number) => React.ReactNode;
  /** Make all images nsfw by default */
  nsfw?: boolean;
};

export function ImageGuard({ images: initialImages, connect, render }: ImageGuardProps) {
  const currentUser = useCurrentUser();
  const shouldBlur = currentUser?.blurNsfw ?? true;

  // alter image nsfw - only allow to be true if shouldBlur is true
  const images = initialImages
    .filter(isDefined)
    .filter((x) => x.id)
    .map((image) => ({
      ...image,
      nsfw: image.nsfw && shouldBlur,
      imageNsfw: image.nsfw,
    }));

  return (
    <ImageGuardCtx.Provider value={{ images, connect }}>
      {images.map((image, index) => (
        <ImageGuardContentProvider key={image.id} image={image}>
          {render(image, index)}
        </ImageGuardContentProvider>
      ))}
    </ImageGuardCtx.Provider>
  );
}

const ImageGuardContentCtx = createContext<{ image: CustomImageModel }>({} as any);
const useImageGuardContentContext = () => {
  const context = useContext(ImageGuardContentCtx);
  if (!context)
    throw new Error('useImageGuardContentContext can only be used inside ImageGuardContentCtx');
  return context;
};
function ImageGuardContentProvider({
  children,
  image,
}: {
  children: React.ReactNode;
  image: ImageModel;
}) {
  return (
    <ImageGuardContentCtx.Provider value={{ image }}>{children}</ImageGuardContentCtx.Provider>
  );
}

ImageGuard.Content = function Content({ children }: ToggleProps) {
  const { connect } = useImageGuardContext();
  const { image } = useImageGuardContentContext();
  const showImage = useStore((state) => state.showingImages[image.id.toString()]);
  const showConnection = useStore((state) =>
    connect ? state.showingConnections[getConnectionKey(connect)] : undefined
  );

  if (!image.nsfw) return children({ status: 'show' });
  const showing = showConnection ?? showImage;

  // if(showConnection || showImage) return children({status: 'show'})

  return children({ status: showing ? 'show' : 'hide' });
};

ImageGuard.Unsafe = function Unsafe({ children }: { children: React.ReactNode }) {
  const { connect } = useImageGuardContext();
  const { image } = useImageGuardContentContext();
  const showImage = useStore((state) => state.showingImages[image.id.toString()] ?? false);
  const showConnection = useStore((state) =>
    connect ? state.showingConnections[getConnectionKey(connect)] : undefined
  );
  const showing = showConnection ?? showImage;

  if (!image.nsfw) return null;
  return image.nsfw && !showing ? <>{children}</> : null;
};

ImageGuard.Safe = function Safe({ children }: { children?: React.ReactNode }) {
  const { connect } = useImageGuardContext();
  const { image } = useImageGuardContentContext();
  const showImage = useStore((state) => state.showingImages[image.id.toString()] ?? false);
  const showConnection = useStore((state) =>
    connect ? state.showingConnections[getConnectionKey(connect)] : undefined
  );
  const showing = showConnection ?? showImage;

  return image.nsfw && !showing ? null : <>{children}</>;
};

type ToggleStatus = 'show' | 'hide';
type ToggleProps = {
  children: ({ status }: { status: ToggleStatus }) => React.ReactElement;
};

ImageGuard.ToggleImage = function ToggleImage({
  position = 'top-left',
  sx,
  className,
}: {
  position?: 'static' | 'top-left' | 'top-right';
  sx?: Sx;
  className?: string;
}) {
  const currentUser = useCurrentUser();
  const { blurNsfw: toggleable } = currentUser ?? {};
  const { connect } = useImageGuardContext();
  const { image } = useImageGuardContentContext();
  const showImage = useStore((state) => state.showingImages[image.id.toString()]);
  const toggleImage = useStore((state) => state.toggleImage);

  if (!!connect) return null;
  const showing = showImage;

  return (
    <ImageGuardPopover>
      <Badge
        color="red"
        variant="filled"
        size="sm"
        px={6}
        sx={(theme) => ({
          cursor: toggleable ? 'pointer' : undefined,
          userSelect: 'none',
          ...(position !== 'static'
            ? {
                position: 'absolute',
                top: theme.spacing.xs,
                left: position === 'top-left' ? theme.spacing.xs : undefined,
                right: position === 'top-right' ? theme.spacing.xs : undefined,
                zIndex: 10,
              }
            : {}),
          ...(sx && sx instanceof Function ? sx(theme) : sx),
        })}
        className={className}
        onClick={toggleable ? () => toggleImage(image.id) : undefined}
      >
        <Group spacing={5} noWrap>
          <Text
            weight="bold"
            sx={{
              whiteSpace: 'nowrap',

              ...(toggleable
                ? {
                    borderRight: '1px solid rgba(0,0,0,.15)',
                    boxShadow: '0 1px 0 1px rgba(255,255,255,.1)',
                    paddingRight: 5,
                  }
                : {}),
            }}
            component="span"
          >
            18
            <Box component="span" sx={{ marginLeft: 1 }}>
              <IconPlus size={8} strokeWidth={5} />
            </Box>
          </Text>
          {toggleable &&
            (showing ? (
              <IconEyeOff size={14} strokeWidth={2.5} />
            ) : (
              <IconEye size={14} strokeWidth={2.5} />
            ))}
        </Group>
      </Badge>
    </ImageGuardPopover>
  );
};

// Old/dynamic version
// ImageGuard.ToggleConnect = function ToggleConnect({ children }: ToggleProps) {
//   const { connect, nsfw } = useImageGuardContext();
//   const { image } = useImageGuardContentContext();
//   const showImage = useStore((state) => state.showingImages[image.id.toString()] ?? false);
//   const showConnect = useStore((state) =>
//     connect ? state.showingConnections[getConnectionKey(connect)] : false
//   );
//   const toggleConnect = useStore((state) => state.toggleConnection);

//   if (!connect || !image.nsfw) return null;
//   const showing = showConnect ?? showImage;

//   return (
//     <ImageGuardPopover>
//       {cloneElement(children({ status: showing ? 'hide' : 'show' }), {
//         onClick: () => toggleConnect(connect),
//       })}
//     </ImageGuardPopover>
//   );
// };

ImageGuard.ToggleConnect = function ToggleConnect({
  position = 'top-left',
  sx,
  className,
}: {
  position?: 'static' | 'top-left' | 'top-right';
  sx?: Sx;
  className?: string;
}) {
  const currentUser = useCurrentUser();
  const { isModerator, blurNsfw: toggleable } = currentUser ?? {};
  const { connect } = useImageGuardContext();
  const { image } = useImageGuardContentContext();
  const showImage = useStore((state) => state.showingImages[image?.id.toString()] ?? false);
  const showConnect = useStore((state) =>
    connect ? state.showingConnections[getConnectionKey(connect)] : false
  );
  const toggleConnect = useStore((state) => state.toggleConnection);

  const showToModerator = image.imageNsfw && isModerator;
  if (!connect || (!image.nsfw && !showToModerator)) return null;

  const showing = showConnect ?? showImage;
  return (
    <ImageGuardPopover>
      <Badge
        color="red"
        variant="filled"
        size="sm"
        px={6}
        sx={(theme) => ({
          cursor: toggleable ? 'pointer' : undefined,
          userSelect: 'none',
          ...(position !== 'static'
            ? {
                position: 'absolute',
                top: theme.spacing.xs,
                left: position === 'top-left' ? theme.spacing.xs : undefined,
                right: position === 'top-right' ? theme.spacing.xs : undefined,
                zIndex: 10,
              }
            : {}),
          ...(sx && sx instanceof Function ? sx(theme) : sx),
        })}
        className={className}
        onClick={toggleable ? () => toggleConnect(connect) : undefined}
      >
        <Group spacing={5} noWrap>
          <Text
            weight="bold"
            sx={{
              whiteSpace: 'nowrap',

              ...(toggleable
                ? {
                    borderRight: '1px solid rgba(0,0,0,.15)',
                    boxShadow: '0 1px 0 1px rgba(255,255,255,.1)',
                    paddingRight: 5,
                  }
                : {}),
            }}
            component="span"
          >
            18
            <Box component="span" sx={{ marginLeft: 1 }}>
              <IconPlus size={8} strokeWidth={5} />
            </Box>
          </Text>
          {toggleable &&
            (showing ? (
              <IconEyeOff size={14} strokeWidth={2.5} />
            ) : (
              <IconEye size={14} strokeWidth={2.5} />
            ))}
        </Group>
      </Badge>
    </ImageGuardPopover>
  );
};

// ImageGuard.ShowAll = function ShowAll({ children }: { children: React.ReactElement }) {
//   const { images } = useImageGuardContext();
//   const { image } = useImageGuardContentContext();
//   const setShowImages = useStore((state) => state.showImages);

//   if (!image.nsfw) return null;

//   return (
//     <ImageGuardPopover>
//       {cloneElement(children, {
//         onClick: () => setShowImages(images.map((x) => x.id)),
//       })}
//     </ImageGuardPopover>
//   );
// };

function ImageGuardPopover({ children }: { children: React.ReactElement }) {
  const user = useCurrentUser();
  const isAuthenticated = !!user;
  const { image } = useImageGuardContentContext();
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  if (image.nsfw && !isAuthenticated)
    return (
      <Popover
        width={300}
        position="bottom"
        opened={opened}
        withArrow
        closeOnClickOutside
        withinPortal
      >
        <Popover.Target>
          {cloneElement(children, {
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              e.nativeEvent.stopImmediatePropagation();
              setOpened((o) => !o);
            },
          })}
        </Popover.Target>
        <Popover.Dropdown>
          <Stack spacing="xs">
            <Group>
              <ThemeIcon color="red" size="xl" variant="outline">
                <IconLock />
              </ThemeIcon>
              <Text size="sm" weight={500} sx={{ flex: 1 }}>
                You must be logged in to view adult content
              </Text>
            </Group>

            <Button size="xs" component={NextLink} href={`/login?returnUrl=${router.asPath}`}>
              Login
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    );

  return cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      children.props.onClick?.();
    },
  });
}
