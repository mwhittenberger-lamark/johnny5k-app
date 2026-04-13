<?php

declare(strict_types=1);

namespace Johnny5k\Tests\Support;

use RuntimeException;

class FakeWpdb {
	public string $prefix = 'wp_';
	public string $usermeta = 'wp_usermeta';
	public int $insert_id = 0;

	/** @var array<string,list<array{needle:string,response:mixed}>> */
	private array $handlers = [
		'get_var' => [],
		'get_row' => [],
		'get_results' => [],
		'get_col' => [],
	];

	/** @var list<array{table:string,data:array}> */
	public array $inserted = [];
	/** @var list<array{table:string,data:array}> */
	public array $replaced = [];
	/** @var list<array{table:string,data:array,where:array}> */
	public array $updated = [];
	/** @var list<array{table:string,where:array}> */
	public array $deleted = [];
	/** @var list<string> */
	public array $queries = [];

	public function expectGetVar( string $needle, mixed $response ): void {
		$this->handlers['get_var'][] = [ 'needle' => $needle, 'response' => $response ];
	}

	public function expectGetRow( string $needle, mixed $response ): void {
		$this->handlers['get_row'][] = [ 'needle' => $needle, 'response' => $response ];
	}

	public function expectGetResults( string $needle, mixed $response ): void {
		$this->handlers['get_results'][] = [ 'needle' => $needle, 'response' => $response ];
	}

	public function expectGetCol( string $needle, mixed $response ): void {
		$this->handlers['get_col'][] = [ 'needle' => $needle, 'response' => $response ];
	}

	public function prepare( string $query, mixed ...$args ): string {
		if ( 1 === count( $args ) && is_array( $args[0] ) ) {
			$args = $args[0];
		}

		foreach ( $args as $arg ) {
			$replacement = is_numeric( $arg ) ? (string) $arg : "'" . str_replace( "'", "\\'", (string) $arg ) . "'";
			$query = preg_replace( '/%d|%f|%s/', $replacement, $query, 1 ) ?? $query;
		}

		return $query;
	}

	public function get_var( string $query ): mixed {
		return $this->resolve( 'get_var', $query );
	}

	public function get_row( string $query, string $output = OBJECT ): mixed {
		$result = $this->resolve( 'get_row', $query );

		if ( ARRAY_A === $output ) {
			if ( is_object( $result ) ) {
				return get_object_vars( $result );
			}

			return is_array( $result ) ? $result : null;
		}

		if ( is_array( $result ) ) {
			return (object) $result;
		}

		return $result;
	}

	public function get_results( string $query, string $output = OBJECT ): array {
		$result = $this->resolve( 'get_results', $query );
		$result = is_array( $result ) ? $result : [];

		if ( ARRAY_A === $output ) {
			return array_map( static function( mixed $row ): array {
				if ( is_object( $row ) ) {
					return get_object_vars( $row );
				}

				return is_array( $row ) ? $row : [];
			}, $result );
		}

		return array_map( static function( mixed $row ): object {
			if ( is_object( $row ) ) {
				return $row;
			}

			return (object) ( is_array( $row ) ? $row : [] );
		}, $result );
	}

	public function get_col( string $query ): array {
		$result = $this->resolve( 'get_col', $query );
		return is_array( $result ) ? array_values( $result ) : [];
	}

	public function insert( string $table, array $data ): int {
		$this->insert_id++;
		$this->inserted[] = [
			'table' => $table,
			'data' => $data,
		];

		return 1;
	}

	public function replace( string $table, array $data ): int {
		$this->replaced[] = [
			'table' => $table,
			'data' => $data,
		];

		return 1;
	}

	public function update( string $table, array $data, array $where, mixed ...$ignored ): int {
		$this->updated[] = [
			'table' => $table,
			'data' => $data,
			'where' => $where,
		];

		return 1;
	}

	public function delete( string $table, array $where, mixed ...$ignored ): int {
		$this->deleted[] = [
			'table' => $table,
			'where' => $where,
		];

		return 1;
	}

	public function query( string $query ): int {
		$this->queries[] = $query;
		return 1;
	}

	private function resolve( string $method, string $query ): mixed {
		foreach ( $this->handlers[ $method ] as $index => $handler ) {
			if ( str_contains( $query, $handler['needle'] ) ) {
				array_splice( $this->handlers[ $method ], $index, 1 );
				return is_callable( $handler['response'] )
					? $handler['response']( $query )
					: $handler['response'];
			}
		}

		throw new RuntimeException( sprintf( "No %s handler matched query:\n%s", $method, $query ) );
	}
}
