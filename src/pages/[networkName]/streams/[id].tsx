import { Box, Card, Container, Grid, List, ListItem, ListItemText, Skeleton, Typography } from "@mui/material";
import { createSkipPaging, Ordering, SkipPaging, Stream, StreamPeriod_OrderBy } from "@superfluid-finance/sdk-core";
import { NextPage } from "next";
import Error from "next/error";
import { useRouter } from "next/router";
import { FC, useState } from "react";
import AccountAddress from "../../../components/AccountAddress";
import FlowingBalance from "../../../components/FlowingBalance";
import SkeletonAddress from "../../../components/skeletons/SkeletonAddress";
import StreamPeriodDataGrid from "../../../components/StreamPeriodDataGrid";
import SuperTokenAddress from "../../../components/SuperTokenAddress";
import { findNetwork, Network } from "../../../redux/networks";
import { sfSubgraph } from "../../../redux/store";

const StreamPage: NextPage = () => {
    const router = useRouter()
    const { networkName, id } = router.query;

    const network = typeof networkName === "string" ? findNetwork(networkName) : undefined;
    if (!network) {
        return <></>;
    }

    return <StreamPageContent streamId={getId(id)} network={network} />;
}

export const StreamPageContent: FC<{ streamId: string, network: Network }> = ({ streamId: id, network }) => {
    const streamQuery = sfSubgraph.useStreamQuery({
        chainId: network.chainId,
        id: id
    });

    const stream: Stream | null | undefined = streamQuery.data;

    const [streamPeriodPaging, setStreamPeriodPaging] = useState<SkipPaging>(createSkipPaging())
    const [streamPeriodOrdering, setStreamPeriodOrdering] = useState<Ordering<StreamPeriod_OrderBy> | undefined>({
        orderBy: "startedAtTimestamp",
        orderDirection: "desc"
    })
    const streamPeriodListQuery = sfSubgraph.useStreamPeriodsQuery({
        chainId: network.chainId,
        filter: {
            stream: id
        },
        pagination: streamPeriodPaging,
        order: streamPeriodOrdering
    });

    if (!streamQuery.isLoading && !streamQuery.data) {
        return <Error statusCode={404} />;
    }

    return <Container component={Box} sx={{ my: 2, py: 2 }}>

        <Grid container spacing={3}>

            <Grid item xs={12}>
                <Typography variant="h3" component="h1">
                    Stream
                </Typography>
            </Grid>

            <Grid item xs={12}>
                <Card elevation={2}>
                    <List>

                        <ListItem divider>
                            <ListItemText secondary="Token" primary={(stream) ? <SuperTokenAddress network={network} address={stream.token} /> : <SkeletonAddress />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Sender" primary={(stream) ? <AccountAddress network={network} address={stream.sender} /> : <SkeletonAddress />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Receiver" primary={(stream) ? <AccountAddress network={network} address={stream.receiver} /> : <SkeletonAddress />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Current Flow Rate" primary={(stream) ? stream.currentFlowRate : <Skeleton sx={{ width: "125px" }} />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Total Amount Streamed" primary={(stream) ? <FlowingBalance
                                {...{
                                    balance: stream.streamedUntilUpdatedAt,
                                    balanceTimestamp: stream.updatedAtTimestamp,
                                    flowRate: stream.currentFlowRate
                                }}
                            /> : <Skeleton sx={{ width: "125px" }} />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Created At" primary={(stream) ? new Date(stream.createdAtTimestamp * 1000).toDateString() : <Skeleton sx={{ width: "100px" }} />} />
                        </ListItem>
                        <ListItem divider>
                            <ListItemText secondary="Subgraph ID" primary={stream && stream.id} />
                        </ListItem>
                    </List>
                </Card>
            </Grid>

            <Grid item xs={12}>
                <Typography variant="h5" component="h2">
                    Stream periods
                </Typography>
            </Grid>

            <Grid item xs={12}>
                <Card elevation={2}>
                    <StreamPeriodDataGrid queryResult={streamPeriodListQuery} setPaging={setStreamPeriodPaging}
                        ordering={streamPeriodOrdering} setOrdering={setStreamPeriodOrdering} />
                </Card>
            </Grid>

        </Grid>

    </Container>;
}

export default StreamPage;

const getId = (id: unknown): string => {
    if (typeof id === "string") {
        return id;
    }
    throw `Id ${id} not found. TODO(KK): error page`;
}