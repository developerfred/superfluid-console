import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Button,
  Chip,
  CircularProgress,
  IconButton,
  OutlinedInput,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { Box } from "@mui/system";
import {
  createSkipPaging,
  Ordering,
  Stream_Filter,
  Stream_OrderBy,
} from "@superfluid-finance/sdk-core";
import { StreamsQuery } from "@superfluid-finance/sdk-redux";
import omit from "lodash/fp/omit";
import set from "lodash/fp/set";
import isEqual from "lodash/isEqual";
import {
  ChangeEvent,
  FC,
  FormEvent,
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import useDebounce from "../../../hooks/useDebounce";
import { Network } from "../../../redux/networks";
import { sfSubgraph } from "../../../redux/store";
import { timeAgo } from "../../../utils/dateTime";
import AccountAddress from "../../AccountAddress";
import FlowingBalanceWithToken from "../../FlowingBalanceWithToken";
import FlowRate from "../../FlowRate";
import InfinitePagination from "../../InfinitePagination";
import InfoTooltipBtn from "../../InfoTooltipBtn";
import { StreamDetailsDialog } from "../../StreamDetails";

export const incomingStreamOrderingDefault: Ordering<Stream_OrderBy> = {
  orderBy: "updatedAtTimestamp",
  orderDirection: "desc",
};

export const incomingStreamPagingDefault = createSkipPaging({
  take: 10,
});

export enum StreamStatus {
  Active,
  Inactive,
}

interface AccountIncomingStreamsTableProps {
  network: Network;
  accountAddress: string;
}

const AccountIncomingStreamsTable: FC<AccountIncomingStreamsTableProps> = ({
  network,
  accountAddress,
}) => {
  const filterAnchorRef = useRef(null);

  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);

  const defaultFilter = {
    receiver: accountAddress,
  };

  const createDefaultArg = (): Required<StreamsQuery> => ({
    chainId: network.chainId,
    filter: defaultFilter,
    pagination: incomingStreamPagingDefault,
    order: incomingStreamOrderingDefault,
  });

  const [streamsQueryArg, setStreamsQueryArg] = useState<
    Required<StreamsQuery>
  >(createDefaultArg());

  const [streamsQueryTrigger, streamsQueryResult] =
    sfSubgraph.useLazyStreamsQuery();

  const streamsQueryTriggerDebounced = useDebounce(streamsQueryTrigger, 250);

  const onStreamQueryArgsChanged = (newArgs: Required<StreamsQuery>) => {
    setStreamsQueryArg(newArgs);

    if (
      streamsQueryResult.originalArgs &&
      !isEqual(streamsQueryResult.originalArgs.filter, newArgs.filter)
    ) {
      streamsQueryTriggerDebounced(newArgs);
    } else {
      streamsQueryTrigger(newArgs);
    }
  };

  useEffect(() => {
    onStreamQueryArgsChanged(createDefaultArg());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, accountAddress]);

  const setPage = (newPage: number) =>
    onStreamQueryArgsChanged(
      set(
        "pagination.skip",
        (newPage - 1) * streamsQueryArg.pagination.take,
        streamsQueryArg
      )
    );

  const setPageSize = (newPageSize: number) =>
    onStreamQueryArgsChanged(
      set("pagination.take", newPageSize, streamsQueryArg)
    );

  const onOrderingChanged = (newOrdering: Ordering<Stream_OrderBy>) =>
    onStreamQueryArgsChanged({ ...streamsQueryArg, order: newOrdering });

  const onSortClicked = (field: Stream_OrderBy) => () => {
    if (streamsQueryArg.order?.orderBy !== field) {
      onOrderingChanged({
        orderBy: field,
        orderDirection: "desc",
      });
    } else if (streamsQueryArg.order.orderDirection === "desc") {
      onOrderingChanged({
        orderBy: field,
        orderDirection: "asc",
      });
    } else {
      onOrderingChanged(incomingStreamOrderingDefault);
    }
  };

  const onFilterChange = (newFilter: Stream_Filter) => {
    onStreamQueryArgsChanged({
      ...streamsQueryArg,
      pagination: { ...streamsQueryArg.pagination, skip: 0 },
      filter: newFilter,
    });
  };

  const onSenderChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onFilterChange({
        ...streamsQueryArg.filter,
        sender_contains: e.target.value.toLowerCase(),
      });
    } else {
      onFilterChange(omit("sender_contains", streamsQueryArg.filter));
    }
  };

  const getStreamStatusFilter = (
    status: StreamStatus | null
  ): Stream_Filter => {
    switch (status) {
      case StreamStatus.Active:
        return { currentFlowRate_gt: "0" };
      case StreamStatus.Inactive:
        return { currentFlowRate: "0" };
      default:
        return {};
    }
  };

  const changeStreamStatus = (newStatus: StreamStatus | null) => {
    const { currentFlowRate_gt, currentFlowRate, ...newFilter } =
      streamsQueryArg.filter;

    setStreamStatus(newStatus);
    onFilterChange({
      ...newFilter,
      ...getStreamStatusFilter(newStatus),
    });
  };

  const onStreamStatusChange = (_event: unknown, newStatus: StreamStatus) =>
    changeStreamStatus(newStatus);

  const clearStreamStatusFilter = () => changeStreamStatus(null);

  const clearFilterField =
    (...fields: Array<keyof Stream_Filter>) =>
    () =>
      onFilterChange(omit(fields, streamsQueryArg.filter));

  const openFilter = () => setShowFilterMenu(true);
  const closeFilter = () => setShowFilterMenu(false);

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    closeFilter();
  };

  const resetFilter = () => {
    onFilterChange(defaultFilter);
    setStreamStatus(null);
    closeFilter();
  };

  const tableRows = streamsQueryResult.data?.data || [];
  const hasNextPage = !!streamsQueryResult.data?.nextPaging;

  const { filter, order, pagination } = streamsQueryArg;

  return (
    <Fragment>
      <Toolbar sx={{ mt: 3, px: 1 }} variant="dense" disableGutters>
        <Typography sx={{ flex: "1 1 100%" }} variant="h6" component="h2">
          Incoming streams
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mx: 2 }}>
          {filter.sender_contains && (
            <Chip
              label={
                <>
                  Sender: <b>{filter.sender_contains}</b>
                </>
              }
              size="small"
              onDelete={clearFilterField("sender_contains")}
            />
          )}

          {streamStatus !== null && (
            <Chip
              label={
                <>
                  Stream status:{" "}
                  <b>
                    {streamStatus === StreamStatus.Active
                      ? "Active"
                      : "Inactive"}
                  </b>
                </>
              }
              size="small"
              onDelete={clearStreamStatusFilter}
            />
          )}
        </Stack>

        <Tooltip title="Filter">
          <IconButton ref={filterAnchorRef} onClick={openFilter}>
            <FilterListIcon />
          </IconButton>
        </Tooltip>
        <Popover
          open={showFilterMenu}
          anchorEl={filterAnchorRef.current}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Stack
            sx={{ p: 3, pb: 2, minWidth: "300px" }}
            component="form"
            onSubmit={onFormSubmit}
            noValidate
            spacing={2}
          >
            <Box>
              <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
                Sender address
              </Typography>
              <OutlinedInput
                autoFocus
                fullWidth
                size="small"
                value={filter.sender_contains || ""}
                onChange={onSenderChange}
                endAdornment={
                  filter.sender_contains && (
                    <IconButton
                      size="small"
                      sx={{ fontSize: "16px", p: 0.5 }}
                      tabIndex={-1}
                      onClick={clearFilterField("sender_contains")}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  )
                }
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
                Is stream active?
              </Typography>

              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={streamStatus}
                onChange={onStreamStatusChange}
              >
                <ToggleButton value={StreamStatus.Active}>Yes</ToggleButton>
                <ToggleButton value={StreamStatus.Inactive}>No</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              {Object.keys(filter).length !== 0 && (
                <Button onClick={resetFilter} tabIndex={-1}>
                  Reset
                </Button>
              )}
              <Button type="submit" tabIndex={-1}>
                Apply
              </Button>
            </Stack>
          </Stack>
        </Popover>
      </Toolbar>
      <Table sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow>
            <TableCell width="220px">Sender</TableCell>
            <TableCell>
              <TableSortLabel
                sx={{ transition: "all 200ms ease-in-out" }}
                active={order?.orderBy === "currentFlowRate"}
                direction={
                  order?.orderBy === "currentFlowRate"
                    ? order?.orderDirection
                    : "desc"
                }
                onClick={onSortClicked("currentFlowRate")}
              >
                Flow Rate
                <InfoTooltipBtn
                  iconSx={{ mb: 0 }}
                  title="Flow rate is the velocity of tokens being streamed."
                />
              </TableSortLabel>
            </TableCell>
            <TableCell>Total Streamed</TableCell>
            <TableCell width="140px">
              <TableSortLabel
                active={order?.orderBy === "updatedAtTimestamp"}
                direction={
                  order?.orderBy === "updatedAtTimestamp"
                    ? order?.orderDirection
                    : "desc"
                }
                onClick={onSortClicked("updatedAtTimestamp")}
              >
                Updated
              </TableSortLabel>
            </TableCell>
            <TableCell width="60px" />
          </TableRow>
        </TableHead>
        <TableBody>
          {tableRows.map((stream) => (
            <TableRow key={stream.id} hover>
              <TableCell>
                <AccountAddress
                  network={network}
                  address={stream.sender}
                  ellipsis={6}
                />
              </TableCell>
              <TableCell>
                <FlowRate flowRate={stream.currentFlowRate} />
              </TableCell>
              <TableCell>
                <FlowingBalanceWithToken
                  balance={stream.streamedUntilUpdatedAt}
                  balanceTimestamp={stream.updatedAtTimestamp}
                  flowRate={stream.currentFlowRate}
                  network={network}
                  tokenAddress={stream.token}
                />
              </TableCell>
              <TableCell>
                {timeAgo(new Date(stream.updatedAtTimestamp * 1000).getTime())}
              </TableCell>

              <TableCell align="right">
                <StreamDetailsDialog network={network} streamId={stream.id}>
                  {(onClick) => (
                    <IconButton
                      sx={{ background: "rgba(255, 255, 255, 0.05)" }}
                      onClick={onClick}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                  )}
                </StreamDetailsDialog>
              </TableCell>
            </TableRow>
          ))}

          {streamsQueryResult.isSuccess && tableRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                sx={{ border: 0, height: "96px" }}
                align="center"
              >
                <Typography variant="body1">No results</Typography>
              </TableCell>
            </TableRow>
          )}

          {streamsQueryResult.isLoading && (
            <TableRow>
              <TableCell
                colSpan={5}
                sx={{ border: 0, height: "96px" }}
                align="center"
              >
                <CircularProgress size={40} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {tableRows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} align="right">
                <InfinitePagination
                  page={(pagination.skip ?? 0) / pagination.take + 1}
                  pageSize={pagination.take}
                  isLoading={streamsQueryResult.isFetching}
                  hasNext={hasNextPage}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  sx={{ justifyContent: "flex-end" }}
                />
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </Fragment>
  );
};

export default AccountIncomingStreamsTable;