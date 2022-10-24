import { Box, Paper, Table, TableProps, Text } from '@mantine/core';
import React from 'react';

export function DescriptionTable({ items, title, ...props }: Props) {
  const rows = items.map((item, index) => (
    <Box component="tr" key={index}>
      <Box
        component="td"
        sx={(theme) => ({
          backgroundColor: theme.colors.gray[0],
        })}
      >
        {typeof item.label === 'string' ? <Text weight="500">{item.label}</Text> : item.label}
      </Box>
      <Box component="td">{item.value}</Box>
    </Box>
  ));

  return (
    <Paper radius="sm" withBorder>
      {title && typeof title === 'string' ? (
        <Text size="md" weight="500" p="xs">
          {title}
        </Text>
      ) : (
        title
      )}
      <Table
        withColumnBorders
        {...props}
        sx={{ borderTop: title ? '1px rgb(222, 226, 230) solid' : undefined }}
      >
        <Box component="tbody">{rows}</Box>
      </Table>
    </Paper>
  );
}

export type Props = TableProps & {
  items: Array<{ label: React.ReactNode; value: React.ReactNode }>;
  title?: React.ReactNode;
};